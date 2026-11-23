import { z } from 'zod'
import { identifier } from './validation'
import type { CardSnapshot, DictionaryOption } from './types'
import { parseCardSnapshot } from './card-snapshot'
import { matchesMaterials } from './material-fineness'

/** Raw form values; numbers may contain a decimal comma. Field IDs are keys in customValues. */
export type CardValues = {
  typeId?: string
  materialIds?: string[]
  stoneIds?: string[]
  fineness?: string
  materialFineness?: Record<string, string>
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
    materialFineness: z.record(identifier, z.string()).optional(),
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
      errors[String(issue.path[0] ?? 'form')] = 'Проверь формат значения'
    return errors
  }
  const input = parsed.data
  const visible = (id: string) =>
    snapshot.fields.some((field) => field.id === id && field.enabled !== false)
  const required = (id: string) =>
    snapshot.fields.some((field) => field.id === id && field.enabled !== false && field.required)
  if (visible('type') && input.typeId !== snapshot.typeId)
    errors.typeId = 'Согласуй размер и тип изделия перед сохранением'
  if (input.materialFineness === undefined && required('fineness') && !input.fineness?.trim())
    errors.fineness = 'Укажи пробу'
  if (
    visible('weight') &&
    (required('weight') || input.weightGrams !== undefined) &&
    parsePositiveNumber(input.weightGrams ?? '') === null
  )
    errors.weightGrams = 'Введи вес больше нуля в граммах'
  if (required('photos') && input.photoIds.length === 0)
    errors.photoIds = 'Добавь хотя бы одну фотографию'
  if (input.photoIds.length > 5) errors.photoIds = 'Можно добавить не больше 5 фотографий'
  const finenessOptions = snapshot.fields.find((field) => field.id === 'fineness')?.options
  if (input.materialFineness !== undefined) {
    if (input.fineness) errors.fineness = 'Укажи пробы отдельно для каждого материала'
    for (const materialId of new Set([
      ...input.materialIds,
      ...Object.keys(input.materialFineness),
    ])) {
      const value = input.materialFineness[materialId]
      const key = `materialFineness.${materialId}`
      if (!input.materialIds.includes(materialId) || (!visible('fineness') && value)) {
        errors[key] = 'Проба указана для отсутствующего материала или скрытого поля'
      } else if (required('fineness') && !value?.trim()) {
        errors[key] = 'Укажи пробу'
      } else if (value) {
        const option = finenessOptions?.find((option) => option.id === value)
        if (!option || (option.metal && !matchesMaterials(option, [materialId])))
          errors[key] = 'Выбери пробу для этого материала'
      }
    }
  }
  if (
    input.fineness &&
    finenessOptions &&
    !finenessOptions.some((option) => option.id === input.fineness)
  )
    errors.fineness = 'Выбери пробу из справочника'
  if (new Set(input.photoIds).size !== input.photoIds.length)
    errors.photoIds = 'Фотографии не должны повторяться'
  if (required('materials') && input.materialIds.length === 0)
    errors.materialIds = 'Выбери хотя бы один материал'
  const checkOptions = (selected: string[], options: DictionaryOption[], key: string) => {
    const allowedIds = new Set(options.map((option) => option.id))
    if (new Set(selected).size !== selected.length || selected.some((id) => !allowedIds.has(id)))
      errors[key] = 'Выбери доступные значения без повторов'
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
      errors.size = 'Выбери размер серёг'
    else if (snapshot.sizeKind !== 'earring' && parsePositiveNumber(input.size!) === null)
      errors.size = 'Введи размер больше нуля'
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
