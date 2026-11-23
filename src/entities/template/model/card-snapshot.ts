import { z } from 'zod'
import { identifier, label, sizeKindSchema } from './validation'
import { fieldSchema, parseTemplate, validateTemplateReferences } from './template-definition'
import { parseDictionaryEntry } from './dictionary'
import { builtinFields } from './defaults'
import { dictionaryOption } from './dictionary-options'
import type {
  CreationTemplate,
  DictionaryEntry,
  DictionaryKind,
  CardSnapshot,
  SnapshotField,
} from './types'

const optionsSchema = z
  .array(
    z
      .object({
        id: identifier,
        label,
        metal: z.enum(['gold', 'silver', 'platinum']).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
      .strict(),
  )
  .refine(
    (options) => new Set(options.map((option) => option.id)).size === options.length,
    'Варианты снимка не должны повторяться',
  )

const snapshotSchema = z
  .object({
    sizeEnabled: z.boolean().optional(),
    templateRevision: z.number().int().nonnegative(),
    typeId: identifier.refine((id) => id !== 'all'),
    typeLabel: label,
    sizeKind: sizeKindSchema,
    fields: z.array(
      fieldSchema.extend({
        enabled: z.literal(true),
        unit: label.optional(),
        options: optionsSchema.optional(),
      }),
    ),
    materials: optionsSchema,
    stones: optionsSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    const ids = new Set<string>()
    const positions = new Set<number>()
    const definitions = builtinFields()
    for (const [index, field] of snapshot.fields.entries()) {
      const issue = (message: string) =>
        context.addIssue({ code: 'custom', path: ['fields', index], message })
      if (ids.has(field.id) || positions.has(field.order))
        issue('ID и позиции полей должны быть уникальны')
      ids.add(field.id)
      positions.add(field.order)
      if (
        field.scope !== 'all' &&
        (new Set(field.scope).size !== field.scope.length || field.scope.includes('all'))
      )
        issue('Некорректная область поля')
      const builtin = definitions.find((definition) => definition.id === field.id)
      if (field.source === 'builtin') {
        if (
          !builtin ||
          field.kind !== builtin.kind ||
          field.required !== builtin.required ||
          field.protected !== builtin.protected ||
          field.scope !== 'all'
        )
          issue('Некорректное встроенное поле')
      } else if (
        builtin ||
        field.kind !== 'text' ||
        field.required ||
        field.protected ||
        field.unit !== undefined ||
        field.options !== undefined
      ) {
        issue('Дополнительное поле должно быть необязательным текстовым полем')
      }
      if (field.id === 'size' && snapshot.sizeKind === 'none')
        issue('Тип без размера не должен содержать поле размера')
    }
  })

/** Read saved definitions independently of the current template and live dictionaries. */
export function parseCardSnapshot(value: unknown): CardSnapshot {
  return snapshotSchema.parse(value)
}

export function buildCardSnapshot(
  template: CreationTemplate,
  entries: DictionaryEntry[],
  typeId: string,
): CardSnapshot {
  const validated = parseTemplate(template)
  const dictionaries = entries.map(parseDictionaryEntry)
  validateTemplateReferences(validated, dictionaries)
  const type = dictionaries.find(
    (entry) => entry.kind === 'type' && entry.id === typeId && entry.enabled,
  )
  if (!type || type.sizeKind === undefined) throw new Error('Выбери доступный тип изделия')
  const options = (kind: DictionaryKind) =>
    dictionaries.filter((entry) => entry.kind === kind && entry.enabled).map(dictionaryOption)
  const materials = options('material')
  const stones = options('stone')
  const fields: SnapshotField[] = validated.fields
    .filter((field) => field.enabled)
    .filter((field) => field.scope === 'all' || field.scope.includes(typeId))
    .filter((field) => field.id !== 'size' || type.sizeKind !== 'none')
    .sort((first, second) => first.order - second.order)
    .map((field) => {
      const result: SnapshotField = {
        ...field,
        scope: field.scope === 'all' ? 'all' : [...field.scope],
      }
      if (field.id === 'fineness') result.options = options('fineness')
      if (field.id === 'weight') result.unit = 'г'
      if (field.id === 'size' && type.sizeKind === 'length') result.unit = 'см'
      if (field.id === 'size' && type.sizeKind === 'earring')
        result.options = [
          { id: 'small', label: 'Маленькие' },
          { id: 'medium', label: 'Средние' },
          { id: 'large', label: 'Большие' },
        ]
      if (field.id === 'materials') result.options = materials.map((option) => ({ ...option }))
      if (field.id === 'stones') result.options = stones.map((option) => ({ ...option }))
      return result
    })
  return {
    sizeEnabled: validated.fields.some((field) => field.id === 'size' && field.enabled),
    templateRevision: validated.revision,
    typeId,
    typeLabel: type.label,
    sizeKind: type.sizeKind,
    fields,
    materials,
    stones,
  }
}
