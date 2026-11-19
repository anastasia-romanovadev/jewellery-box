import { z } from 'zod'
import {
  DEFAULT_TEMPLATE,
  DEFAULT_DICTIONARIES,
  parseTemplate,
  parseDictionaryEntry,
  normalizeDictionaryLabel,
  type CreationTemplate,
  type DictionaryEntry,
} from '../entities/template/model/template'
import { readAppearanceCache, type AppearanceSettings } from '../shared/lib/appearance-cache'
import { database, type JewelleryDatabase, type AppearanceRecord } from './database'

const appearanceSchema = z.object({
  id: z.literal('appearance'),
  revision: z.number().int().positive(),
  themeMode: z.enum(['system', 'light', 'dark']),
  accentTone: z.enum(['burgundy', 'forest', 'ochre']),
})

export class ConflictError extends Error {
  constructor() {
    super(
      'Данные изменились в другой вкладке. Ваши правки сохранены в редакторе. Загрузите актуальную версию перед повторным редактированием.',
    )
    this.name = 'ConflictError'
  }
}

export function storageErrorMessage(error: unknown): string {
  if (error instanceof ConflictError) return error.message
  if (error instanceof z.ZodError)
    return 'Данные не прошли проверку. Проверьте заполнение полей; сохранённые данные не изменены.'
  if (error instanceof CatalogValidationError) return error.message
  return 'Не удалось обратиться к хранилищу. Проверьте доступ браузера и свободное место, затем повторите попытку.'
}

class CatalogValidationError extends Error {}

export async function initializeDatabase(db: JewelleryDatabase = database): Promise<void> {
  const cached = readAppearanceCache()
  await db.transaction('rw', db.templates, db.dictionaries, db.settings, async () => {
    // Template existence marks initial seeding. Deleted dictionary choices are never reseeded.
    if (!(await db.templates.get('creation'))) {
      if ((await db.dictionaries.count()) !== 0) {
        throw new CatalogValidationError(
          'Шаблон отсутствует в существующей базе. Данные сохранены; автоматическая замена отключена.',
        )
      }
      await db.templates.add(parseTemplate(structuredClone(DEFAULT_TEMPLATE)))
      await db.dictionaries.bulkAdd(
        DEFAULT_DICTIONARIES.map((entry) => parseDictionaryEntry(structuredClone(entry))),
      )
    }
    if (!(await db.settings.get('appearance'))) {
      await db.settings.add(appearanceSchema.parse({ id: 'appearance', revision: 1, ...cached }))
    }
  })
}

export type Catalog = { template: CreationTemplate; entries: DictionaryEntry[] }

export async function getCatalog(db: JewelleryDatabase = database): Promise<Catalog> {
  await initializeDatabase(db)
  return readCatalog(db)
}

export async function readCatalog(db: JewelleryDatabase = database): Promise<Catalog> {
  return db.transaction('r', db.templates, db.dictionaries, async () => ({
    template: parseTemplate(await db.templates.get('creation')),
    entries: (await db.dictionaries.toArray()).map(parseDictionaryEntry),
  }))
}

export async function saveTemplate(
  draft: CreationTemplate,
  db: JewelleryDatabase = database,
): Promise<CreationTemplate> {
  const parsed = parseTemplate(draft)
  await initializeDatabase(db)
  return db.transaction('rw', db.templates, db.dictionaries, async () => {
    const current = parseTemplate(await db.templates.get('creation'))
    if (current.revision !== parsed.revision) throw new ConflictError()
    const types = (await db.dictionaries.toArray())
      .map(parseDictionaryEntry)
      .filter((entry) => entry.kind === 'type')
    for (const field of parsed.fields) {
      if (field.scope === 'all') continue
      for (const typeId of field.scope) {
        const type = types.find((entry) => entry.id === typeId)
        const priorField = current.fields.find((entry) => entry.id === field.id)
        const priorScope = priorField?.scope
        if (
          !type ||
          (!type.enabled && !(Array.isArray(priorScope) && priorScope.includes(typeId)))
        ) {
          throw new CatalogValidationError(
            'Выбранный тип изделия больше недоступен. Проверьте область применения поля.',
          )
        }
      }
    }
    const saved = { ...parsed, revision: current.revision + 1 }
    await db.templates.put(saved)
    return saved
  })
}

export async function saveDictionaryEntry(
  draft: DictionaryEntry,
  db: JewelleryDatabase = database,
): Promise<DictionaryEntry> {
  const parsed = parseDictionaryEntry(draft)
  await initializeDatabase(db)
  return db.transaction('rw', db.dictionaries, async () => {
    const raw = await db.dictionaries.get(parsed.id)
    const current = raw ? parseDictionaryEntry(raw) : undefined
    if (current ? current.revision !== parsed.revision : parsed.revision !== 0)
      throw new ConflictError()
    if (current && current.kind !== parsed.kind)
      throw new CatalogValidationError('Нельзя переносить значение в другой справочник.')
    if (current?.kind === 'type' && current.sizeKind !== parsed.sizeKind) {
      throw new CatalogValidationError(
        'Формат размера существующего типа нельзя менять: создайте отдельный тип изделия.',
      )
    }
    if (!current && !parsed.enabled)
      throw new CatalogValidationError('Нельзя создать удалённый вариант.')
    if (parsed.enabled) {
      const normalized = normalizeDictionaryLabel(parsed.label)
      const others = (await db.dictionaries.where('kind').equals(parsed.kind).toArray()).map(
        parseDictionaryEntry,
      )
      if (
        others.some(
          (entry) =>
            entry.id !== parsed.id &&
            entry.enabled &&
            normalizeDictionaryLabel(entry.label) === normalized,
        )
      ) {
        throw new CatalogValidationError('Такое название уже есть в этом справочнике.')
      }
    }
    const saved = { ...parsed, revision: (current?.revision ?? 0) + 1 }
    await db.dictionaries.put(saved)
    return saved
  })
}

export async function getAppearance(db: JewelleryDatabase = database): Promise<AppearanceRecord> {
  await initializeDatabase(db)
  return readAppearance(db)
}

export async function readAppearance(db: JewelleryDatabase = database): Promise<AppearanceRecord> {
  return appearanceSchema.parse(await db.settings.get('appearance'))
}

export async function saveAppearance(
  settings: AppearanceSettings,
  expectedRevision: number,
  db: JewelleryDatabase = database,
): Promise<AppearanceRecord> {
  const parsed = appearanceSchema.parse({
    ...settings,
    id: 'appearance',
    revision: expectedRevision,
  })
  await initializeDatabase(db)
  return db.transaction('rw', db.settings, async () => {
    const current = appearanceSchema.parse(await db.settings.get('appearance'))
    if (current.revision !== expectedRevision) throw new ConflictError()
    const saved = { ...parsed, revision: current.revision + 1 }
    await db.settings.put(saved)
    return saved
  })
}
