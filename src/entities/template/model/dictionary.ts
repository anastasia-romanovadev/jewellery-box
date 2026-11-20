import { z } from 'zod'
import { identifier, label, sizeKindSchema } from './validation'
import type { DictionaryEntry } from './types'

const dictionaryEntrySchema = z
  .object({
    id: identifier,
    kind: z.enum(['type', 'material', 'stone', 'fineness']),
    label,
    enabled: z.boolean(),
    revision: z.number().int().nonnegative(),
    sizeKind: sizeKindSchema.optional(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.id === 'all') {
      context.addIssue({
        code: 'custom',
        path: ['id'],
        message: '«Все» — фильтр, а не значение справочника',
      })
    }
    if (entry.kind === 'type' && entry.sizeKind === undefined) {
      context.addIssue({ code: 'custom', path: ['sizeKind'], message: 'Выберите формат размера' })
    }
    if (entry.kind !== 'type' && entry.sizeKind !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['sizeKind'],
        message: 'Формат размера относится только к типу изделия',
      })
    }
  })

export function parseDictionaryEntry(value: unknown): DictionaryEntry {
  return dictionaryEntrySchema.parse(value)
}

export function normalizeDictionaryLabel(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('ru')
}
