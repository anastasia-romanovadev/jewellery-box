import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JewelleryDatabase } from './database'
import {
  ConflictError,
  getAppearance,
  getCatalog,
  initializeDatabase,
  saveAppearance,
  saveDictionaryEntry,
  saveTemplate,
} from './catalog-repository'
import type {
  CreationTemplate,
  DictionaryEntry,
  TemplateField,
} from '../entities/template/model/template'

let db: JewelleryDatabase
const connections: JewelleryDatabase[] = []

function anotherConnection() {
  const connection = new JewelleryDatabase(db.name)
  connections.push(connection)
  return connection
}

function customField(
  template: CreationTemplate,
  scope: TemplateField['scope'] = 'all',
): TemplateField {
  return {
    id: 'custom-clasp',
    source: 'custom',
    label: 'Тип застёжки',
    kind: 'text',
    enabled: true,
    required: false,
    protected: false,
    scope,
    order: Math.max(...template.fields.map((field) => field.order)) + 1,
  }
}

function material(label = 'Титан'): DictionaryEntry {
  return { id: crypto.randomUUID(), kind: 'material', label, enabled: true, revision: 0 }
}

beforeEach(() => {
  db = new JewelleryDatabase(`jewellery-box-repository-test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.close()
  vi.restoreAllMocks()
  await db.delete()
})

describe('catalog persistence', () => {
  it('rejects editing fixed types and hiding the mandatory type field', async () => {
    const { template, entries } = await getCatalog(db)
    const type = entries.find((entry) => entry.kind === 'type')!
    await expect(saveDictionaryEntry({ ...type, enabled: false }, db)).rejects.toThrow(
      'фиксированы',
    )
    await expect(saveDictionaryEntry({ ...type, id: 'new-type', revision: 0 }, db)).rejects.toThrow(
      'фиксированы',
    )
    await expect(
      saveTemplate(
        {
          ...template,
          fields: template.fields.map((field) =>
            field.id === 'type' ? { ...field, enabled: false } : field,
          ),
        },
        db,
      ),
    ).rejects.toThrow()
    expect((await getCatalog(db)).template).toEqual(template)
  })
  it('migrates v1 fields without data loss and restores removed optional fields as hidden', async () => {
    const original = await getCatalog(db)
    const appearance = await getAppearance(db)
    await db.delete()
    const legacy = new Dexie(db.name)
    legacy.version(1).stores({ templates: 'id', dictionaries: 'id, kind', settings: 'id' })
    const fields = original.template.fields
      .filter((field) => field.id !== 'stones')
      .map((field) => {
        const { enabled, ...rest } = field
        expect(enabled).toBe(true)
        return rest
      })
    const oldTemplate = { ...original.template, revision: 8, fields }
    try {
      await legacy.table('templates').put(oldTemplate)
      await legacy.table('dictionaries').bulkPut(original.entries)
      await legacy.table('settings').put(appearance)
    } finally {
      legacy.close()
    }
    await db.open()
    const migrated = await getCatalog(db)
    expect(migrated.template.revision).toBe(8)
    expect(migrated.template.fields.slice(0, fields.length)).toEqual(
      fields.map((field) => ({ ...field, enabled: true })),
    )
    expect(migrated.template.fields.at(-1)).toMatchObject({ id: 'stones', enabled: false })
    expect(new Set(migrated.template.fields.map((field) => field.order)).size).toBe(
      migrated.template.fields.length,
    )
    expect(migrated.entries.filter((entry) => entry.enabled)).toEqual(original.entries)
    expect(await getAppearance(db)).toEqual(appearance)
    db.close()
    await db.open()
    expect(await getCatalog(db)).toEqual(migrated)
  })
  it('initializes once even when two connections open the same new database', async () => {
    const other = anotherConnection()
    await Promise.all([initializeDatabase(db), initializeDatabase(other)])
    const initial = await getCatalog(db)
    await initializeDatabase(db)

    expect(await getCatalog(other)).toEqual(initial)
    expect(await db.templates.count()).toBe(1)
    expect(await db.settings.count()).toBe(1)
    expect(new Set(initial.entries.map((entry) => entry.id)).size).toBe(initial.entries.length)
    expect(initial.entries.length).toBeGreaterThan(0)
  })

  it('imports legacy JSON appearance only on first creation and subsequently trusts the database', async () => {
    localStorage.setItem('jewellery-box:theme-mode', '"dark"')
    localStorage.setItem('jewellery-box:accent-tone', '"forest"')
    const initial = await getAppearance(db)
    expect(initial).toMatchObject({ themeMode: 'dark', accentTone: 'forest', revision: 1 })

    const saved = await saveAppearance(
      { themeMode: 'light', accentTone: 'ochre' },
      initial.revision,
      db,
    )
    localStorage.setItem('jewellery-box:theme-mode', 'dark')
    localStorage.setItem('jewellery-box:accent-tone', 'burgundy')
    expect(await getAppearance(anotherConnection())).toEqual(saved)
  })

  it('rolls back initial template and dictionaries if saving settings fails', async () => {
    const failure = vi.spyOn(db.settings, 'add').mockImplementation(() => {
      throw new DOMException('Storage quota exhausted', 'QuotaExceededError')
    })
    await expect(initializeDatabase(db)).rejects.toThrow('Storage quota exhausted')
    expect(await db.templates.count()).toBe(0)
    expect(await db.dictionaries.count()).toBe(0)
    expect(await db.settings.count()).toBe(0)

    failure.mockRestore()
    await initializeDatabase(db)
    expect(await db.templates.count()).toBe(1)
  })

  it('reopens saved templates and dictionary entries without replacing them with defaults', async () => {
    const initial = await getCatalog(db)
    const template = await saveTemplate(
      { ...initial.template, fields: [...initial.template.fields, customField(initial.template)] },
      db,
    )
    const entry = await saveDictionaryEntry(material(), db)
    db.close()

    const reopened = await getCatalog(anotherConnection())
    expect(reopened.template).toEqual(template)
    expect(reopened.entries).toContainEqual(entry)
  })

  it('keeps the previous template intact when a write fails', async () => {
    const { template } = await getCatalog(db)
    vi.spyOn(db.templates, 'put').mockImplementation(() => {
      throw new DOMException('Cannot write', 'QuotaExceededError')
    })
    const draft = { ...template, fields: [...template.fields, customField(template)] }

    await expect(saveTemplate(draft, db)).rejects.toThrow('Cannot write')
    expect((await getCatalog(db)).template).toEqual(template)
    expect(draft.fields.at(-1)?.label).toBe('Тип застёжки')
  })

  it('rejects removal of a protected field and unknown type scopes before modifying data', async () => {
    const { template } = await getCatalog(db)
    await expect(
      saveTemplate(
        { ...template, fields: template.fields.filter((field) => field.id !== 'photos') },
        db,
      ),
    ).rejects.toThrow()
    await expect(
      saveTemplate(
        { ...template, fields: [...template.fields, customField(template, ['unknown-type'])] },
        db,
      ),
    ).rejects.toThrow('больше недоступен')
    expect((await getCatalog(db)).template).toEqual(template)
  })

  it('detects stale template revisions from another connection without losing the newer fields', async () => {
    const other = anotherConnection()
    const firstDraft = (await getCatalog(db)).template
    const staleDraft = (await getCatalog(other)).template
    const saved = await saveTemplate(
      { ...firstDraft, fields: [...firstDraft.fields, customField(firstDraft)] },
      db,
    )

    await expect(saveTemplate(staleDraft, other)).rejects.toBeInstanceOf(ConflictError)
    expect((await getCatalog(other)).template).toEqual(saved)
  })
})

describe('dictionary preservation', () => {
  it('normalizes names and rejects active duplicates within the same dictionary', async () => {
    const saved = await saveDictionaryEntry(material('  Титан  '), db)
    expect(saved.label).toBe('Титан')
    await expect(saveDictionaryEntry(material('титан'), db)).rejects.toThrow('уже есть')
    await expect(saveDictionaryEntry(material('  '), db)).rejects.toThrow()

    const stone = await saveDictionaryEntry({ ...material('Титан'), kind: 'stone' }, db)
    expect(stone.kind).toBe('stone')
  })

  it('retains deactivated records and does not seed them again', async () => {
    const initial = await getCatalog(db)
    const entry = initial.entries.find((value) => value.kind === 'material')
    if (!entry) throw new Error('Expected a seeded material')
    const deactivated = await saveDictionaryEntry({ ...entry, enabled: false }, db)
    await initializeDatabase(db)

    const after = await getCatalog(anotherConnection())
    expect(after.entries).toHaveLength(initial.entries.length)
    expect(after.entries.find((value) => value.id === entry.id)).toEqual(deactivated)
    expect(entry.enabled).toBe(true)
    expect(deactivated.id).toBe(entry.id)
  })

  it('preserves existing field scopes for deactivated types but rejects new references to them', async () => {
    const initial = await getCatalog(db)
    const type = initial.entries.find((entry) => entry.kind === 'type')
    if (!type) throw new Error('Expected a seeded type')
    const saved = await saveTemplate(
      {
        ...initial.template,
        fields: [...initial.template.fields, customField(initial.template, [type.id])],
      },
      db,
    )
    // Simulate a legacy disabled type; the current editor cannot disable fixed types.
    await db.dictionaries.put({ ...type, enabled: false })

    const renamed = await saveTemplate(
      {
        ...saved,
        fields: saved.fields.map((field) =>
          field.id === 'custom-clasp' ? { ...field, label: 'Застёжка' } : field,
        ),
      },
      db,
    )
    expect(renamed.fields.find((field) => field.id === 'custom-clasp')?.scope).toEqual([type.id])
    const added = { ...customField(renamed, [type.id]), id: 'another-custom-field' }
    await expect(
      saveTemplate({ ...renamed, fields: [...renamed.fields, added] }, db),
    ).rejects.toThrow('больше недоступен')
  })

  it('rejects stale dictionary and appearance edits across connections', async () => {
    const other = anotherConnection()
    const entry = await saveDictionaryEntry(material(), db)
    const renamed = await saveDictionaryEntry({ ...entry, label: 'Титан матовый' }, db)
    await expect(saveDictionaryEntry({ ...entry, enabled: false }, other)).rejects.toBeInstanceOf(
      ConflictError,
    )
    expect((await getCatalog(other)).entries.find((value) => value.id === entry.id)).toEqual(
      renamed,
    )

    const appearance = await getAppearance(db)
    const saved = await saveAppearance(
      { themeMode: 'dark', accentTone: 'forest' },
      appearance.revision,
      db,
    )
    await expect(
      saveAppearance({ themeMode: 'light', accentTone: 'ochre' }, appearance.revision, other),
    ).rejects.toBeInstanceOf(ConflictError)
    expect(await getAppearance(other)).toEqual(saved)
  })

  it('never silently replaces a malformed stored template with defaults', async () => {
    const initial = await getCatalog(db)
    await db.templates.update('creation', { fields: [] })

    await expect(getCatalog(db)).rejects.toThrow()
    expect((await db.templates.get('creation'))?.fields).toEqual([])
    expect(await db.dictionaries.count()).toBe(initial.entries.length)
  })
})
