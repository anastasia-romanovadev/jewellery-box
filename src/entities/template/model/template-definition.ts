import { z } from 'zod'
import { identifier, label } from './validation'
import { builtinFields } from './defaults'
import type { CreationTemplate, DictionaryEntry } from './types'

export const fieldSchema = z
  .object({
    id: identifier,
    source: z.enum(['builtin', 'custom']),
    label,
    kind: z.enum(['text', 'number', 'photos', 'multi-select', 'type', 'size']),
    enabled: z.boolean().default(true),
    required: z.boolean(),
    protected: z.boolean(),
    scope: z.union([z.literal('all'), z.array(identifier).min(1)]),
    order: z.number().int().nonnegative(),
  })
  .strict()

const templateSchema = z
  .object({
    id: z.literal('creation'),
    revision: z.number().int().nonnegative(),
    fields: z.array(fieldSchema),
  })
  .strict()
  .superRefine((template, context) => {
    const definitions = builtinFields()
    const ids = new Set<string>()
    const positions = new Set<number>()
    for (const [index, field] of template.fields.entries()) {
      const issue = (message: string) =>
        context.addIssue({ code: 'custom', path: ['fields', index], message })
      if (ids.has(field.id)) issue('ID полей не должны повторяться')
      ids.add(field.id)
      if (positions.has(field.order)) issue('Позиции полей не должны повторяться')
      positions.add(field.order)
      if (field.scope !== 'all' && new Set(field.scope).size !== field.scope.length)
        issue('Типы изделия в области поля не должны повторяться')
      if (field.scope !== 'all' && field.scope.includes('all'))
        issue('«Все» не является ID типа изделия')
      const builtin = definitions.find((definition) => definition.id === field.id)
      if (field.source === 'builtin') {
        if (
          !builtin ||
          field.kind !== builtin.kind ||
          field.required !== builtin.required ||
          field.protected !== builtin.protected ||
          field.scope !== 'all' ||
          field.label !== builtin.label
        ) {
          issue('Определение встроенного поля нельзя изменить; доступно скрытие')
        }
      } else if (builtin || field.kind !== 'text' || field.required || field.protected) {
        issue('Дополнительное поле должно быть необязательным текстовым полем с собственным ID')
      }
    }
    for (const field of definitions.filter((definition) => definition.protected)) {
      if (!ids.has(field.id))
        context.addIssue({
          code: 'custom',
          path: ['fields'],
          message: `Нельзя удалить поле «${field.label}»`,
        })
    }
  })

export function parseTemplate(value: unknown): CreationTemplate {
  return templateSchema.parse(value)
}

export function validateTemplateReferences(
  template: CreationTemplate,
  entries: DictionaryEntry[],
): void {
  const typeIds = new Set(entries.filter((entry) => entry.kind === 'type').map((entry) => entry.id))
  for (const field of template.fields) {
    if (field.scope !== 'all' && field.scope.some((id) => !typeIds.has(id))) {
      throw new Error(`У поля «${field.label}» указан неизвестный тип изделия`)
    }
  }
}
