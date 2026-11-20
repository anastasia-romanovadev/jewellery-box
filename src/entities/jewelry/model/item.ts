import { z } from 'zod'
import {
  parseCardSnapshot,
  parsePositiveNumber,
  validateCardValues,
  type CardSnapshot,
  type CardValues,
  type DictionaryEntry,
  type SnapshotField,
} from '../../template/model/template'
import { builtinFields } from '../../template/model/defaults'

const id = z.string().trim().min(1)
const ids = z.array(id).refine((values) => new Set(values).size === values.length)
const snapshotSchema = z.unknown().transform((value, context) => {
  try {
    return parseCardSnapshot(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'Повреждена схема карточки' })
    return z.NEVER
  }
})
const itemSchema = z
  .object({
    id,
    revision: z.number().int().positive(),
    typeId: id,
    snapshot: snapshotSchema,
    materialIds: ids,
    stoneIds: ids,
    finenessId: id.optional(),
    weightGrams: z.number().finite().positive().optional(),
    size: z
      .union([z.number().finite().positive(), z.enum(['small', 'medium', 'large'])])
      .optional(),
    notes: z.string(),
    customValues: z.record(z.string(), z.string()),
    photoIds: ids.refine((values) => values.length <= 5),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
export type JewelryItem = z.infer<typeof itemSchema>
export type PhotoRecord = {
  id: string
  itemId: string
  blob: Blob
  originalName: string
  mimeType: string
  byteSize: number
  width: number
  height: number
}
export type NewPhoto = Omit<PhotoRecord, 'itemId'>
export type JewelryDraft = {
  id: string
  revision: number
  snapshot: CardSnapshot
  values: CardValues
}

export function itemValues(item: JewelryItem): CardValues {
  return {
    typeId: item.typeId,
    materialIds: [...item.materialIds],
    stoneIds: [...item.stoneIds],
    fineness: item.finenessId,
    weightGrams: item.weightGrams,
    size: item.size,
    notes: item.notes,
    customValues: { ...item.customValues },
    photoIds: [...item.photoIds],
  }
}
export function parseItem(value: unknown): JewelryItem {
  const item = itemSchema.parse(value)
  if (
    item.typeId !== item.snapshot.typeId ||
    Object.keys(validateCardValues(item.snapshot, itemValues(item))).length
  )
    throw new Error('Данные карточки не соответствуют её схеме')
  return item
}
export function normalizeValues(snapshot: CardSnapshot, values: CardValues) {
  const has = (id: string) => snapshot.fields.some((field) => field.id === id)
  return {
    typeId: snapshot.typeId,
    materialIds: has('materials') ? (values.materialIds ?? []) : [],
    stoneIds: has('stones') ? (values.stoneIds ?? []) : [],
    finenessId: has('fineness') ? values.fineness || undefined : undefined,
    weightGrams: has('weight')
      ? (parsePositiveNumber(values.weightGrams ?? '') ?? undefined)
      : undefined,
    size:
      !has('size') || values.size === '' || values.size === undefined
        ? undefined
        : snapshot.sizeKind === 'earring'
          ? values.size
          : (parsePositiveNumber(values.size) ?? undefined),
    notes: has('notes') ? (values.notes ?? '') : '',
    customValues: values.customValues,
    photoIds: has('photos') ? (values.photoIds ?? []) : [],
  }
}

/** Only size changes its definition; all other saved fields remain intact. */
export function changeItemType(
  snapshot: CardSnapshot,
  values: CardValues,
  type: DictionaryEntry,
): { snapshot: CardSnapshot; values: CardValues } {
  if (type.kind !== 'type' || !type.enabled || !type.sizeKind) throw new Error('Тип недоступен')
  const next = structuredClone(snapshot)
  const previousSize = next.fields.find((field) => field.id === 'size')
  const sizeEnabled = next.sizeEnabled ?? Boolean(previousSize)
  next.typeId = type.id
  next.typeLabel = type.label
  next.sizeKind = type.sizeKind
  next.fields = next.fields.filter((field) => field.id !== 'size')
  if (sizeEnabled && type.sizeKind !== 'none') {
    const definition = previousSize ?? builtinFields().find((field) => field.id === 'size')!
    const field: SnapshotField = {
      ...definition,
      order: previousSize?.order ?? Math.max(-1, ...next.fields.map((field) => field.order)) + 1,
    }
    delete field.unit
    delete field.options
    if (type.sizeKind === 'length') field.unit = 'см'
    if (type.sizeKind === 'earring')
      field.options = [
        { id: 'small', label: 'Маленькие' },
        { id: 'medium', label: 'Средние' },
        { id: 'large', label: 'Большие' },
      ]
    next.fields.push(field)
    next.fields.sort((a, b) => a.order - b.order)
  }
  return {
    snapshot: parseCardSnapshot(next),
    values: {
      ...values,
      typeId: type.id,
      size: snapshot.sizeKind === type.sizeKind ? values.size : undefined,
    },
  }
}

export type CollectionFilters = {
  materials: string[]
  stones: string[]
  sizeKind: string
  sizeMin: string
  sizeMax: string
  earringSize: string
  weightMin: string
  weightMax: string
}
export const EMPTY_FILTERS: CollectionFilters = {
  materials: [],
  stones: [],
  sizeKind: '',
  sizeMin: '',
  sizeMax: '',
  earringSize: '',
  weightMin: '',
  weightMax: '',
}
function within(value: number | undefined, min: string, max: string) {
  if (!min && !max) return true
  const lower = min ? Number(min.replace(',', '.')) : -Infinity
  const upper = max ? Number(max.replace(',', '.')) : Infinity
  return value !== undefined && value >= lower && value <= upper
}
export function filterItems(items: JewelryItem[], category: string, filters: CollectionFilters) {
  return items
    .filter(
      (item) =>
        (category === 'all' || item.typeId === category) &&
        (!filters.materials.length ||
          filters.materials.some((id) => item.materialIds.includes(id))) &&
        (!filters.stones.length || filters.stones.some((id) => item.stoneIds.includes(id))) &&
        within(item.weightGrams, filters.weightMin, filters.weightMax) &&
        (!filters.sizeKind ||
          (item.snapshot.sizeKind === filters.sizeKind &&
            item.size !== undefined &&
            (filters.sizeKind === 'earring'
              ? !filters.earringSize || item.size === filters.earringSize
              : within(
                  typeof item.size === 'number' ? item.size : undefined,
                  filters.sizeMin,
                  filters.sizeMax,
                )))),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}
