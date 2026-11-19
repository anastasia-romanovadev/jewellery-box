import { z } from 'zod'
import { identifier } from './validation'
import type { CardSnapshot, DictionaryOption } from './types'
import { parseCardSnapshot } from './card-snapshot'

/** Raw form values; numbers may contain a decimal comma. Field IDs are keys in customValues. */
export type CardValues = {
  typeId?: string
  materialIds?: string[]
  stoneIds?: string[]
  fineness?: string
  weightGrams?: string | number
  photoIds?: string[]
  notes?: string
  size?: string | number
  customValues: Record<string, string>
}

const cardValuesSchema = z
  .object({
    typeId: z.string().optional(),
    materialIds: z.array(identifier).default([]),
    stoneIds: z.array(identifier).default([]),
    fineness: z.string().optional(),
    weightGrams: z.union([z.string(), z.number()]).optional(),
    photoIds: z.array(identifier).default([]),
    notes: z.string().optional(),
    size: z.union([z.string(), z.number()]).optional(),
    customValues: z.record(z.string(), z.string()),
  })
  .strict()

export function parsePositiveNumber(value: string | number): number | null {
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value
  if (normalized === '') return null
  const number = Number(normalized)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** Validate against the saved snapshot, never the current template or live dictionaries. */
export function validateCardValues(
  snapshot: CardSnapshot,
  values: unknown,
): Record<string, string> {
  snapshot = parseCardSnapshot(snapshot)
  const parsed = cardValuesSchema.safeParse(values)
  const errors: Record<string, string> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      errors[String(issue.path[0] ?? 'form')] = 'Проверьте формат значения'
    return errors
  }
  const input = parsed.data
  const visible = (id: string) =>
    snapshot.fields.some((field) => field.id === id && field.enabled !== false)
  const required = (id: string) =>
    snapshot.fields.some((field) => field.id === id && field.enabled !== false && field.required)
  if (visible('type') && input.typeId !== snapshot.typeId)
    errors.typeId = 'Согласуйте размер и тип изделия перед сохранением'
  if (required('fineness') && !input.fineness?.trim()) errors.fineness = 'Укажите пробу'
  if (
    visible('weight') &&
    (required('weight') || input.weightGrams !== undefined) &&
    parsePositiveNumber(input.weightGrams ?? '') === null
  )
    errors.weightGrams = 'Введите вес больше нуля в граммах'
  if (required('photos') && input.photoIds.length === 0)
    errors.photoIds = 'Добавьте хотя бы одну фотографию'
  if (new Set(input.photoIds).size !== input.photoIds.length)
    errors.photoIds = 'Фотографии не должны повторяться'
  if (required('materials') && input.materialIds.length === 0)
    errors.materialIds = 'Выберите хотя бы один материал'
  const checkOptions = (selected: string[], options: DictionaryOption[], key: string) => {
    const allowedIds = new Set(options.map((option) => option.id))
    if (new Set(selected).size !== selected.length || selected.some((id) => !allowedIds.has(id)))
      errors[key] = 'Выберите доступные значения без повторов'
  }
  checkOptions(input.materialIds, snapshot.materials, 'materialIds')
  checkOptions(input.stoneIds, snapshot.stones, 'stoneIds')
  if (!snapshot.fields.some((field) => field.id === 'stones') && input.stoneIds.length > 0)
    errors.stoneIds = 'В этой карточке нет поля «Камни»'
  const hasSize = input.size !== undefined && input.size !== ''
  if (hasSize) {
    if (!snapshot.fields.some((field) => field.id === 'size'))
      errors.size = 'В этой карточке нет поля «Размер»'
    else if (
      snapshot.sizeKind === 'earring' &&
      !['small', 'medium', 'large'].includes(String(input.size))
    )
      errors.size = 'Выберите размер серёг'
    else if (snapshot.sizeKind !== 'earring' && parsePositiveNumber(input.size!) === null)
      errors.size = 'Введите размер больше нуля'
  }
  const customIds = new Set(
    snapshot.fields.filter((field) => field.source === 'custom').map((field) => field.id),
  )
  for (const id of Object.keys(input.customValues)) {
    if (!customIds.has(id))
      errors[`customValues.${id}`] = 'Поле отсутствует в сохранённой схеме карточки'
  }
  return errors
}
