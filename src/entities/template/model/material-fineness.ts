import type { CardSnapshot, DictionaryOption, FinenessMetal } from './types'
import type { CardValues } from './card-values'

const MATERIAL_METALS: Record<string, FinenessMetal> = {
  'gold-white': 'gold',
  'gold-red': 'gold',
  'gold-yellow': 'gold',
  silver: 'silver',
  platinum: 'platinum',
}

export function matchesMaterials(option: Pick<DictionaryOption, 'metal'>, materialIds: string[]) {
  return materialIds.some((id) => option.metal === materialMetal(id))
}

export function materialMetal(id: string): FinenessMetal | undefined {
  return Object.hasOwn(MATERIAL_METALS, id) ? MATERIAL_METALS[id] : undefined
}

export function selectedFineness(values?: CardValues): string[] {
  return values?.materialFineness !== undefined
    ? Object.values(values.materialFineness).filter(Boolean)
    : values?.fineness
      ? [values.fineness]
      : []
}

/** Never guess which of several materials an old shared assay belonged to. */
export function editableFineness(
  snapshot: CardSnapshot,
  values: CardValues,
): Record<string, string> {
  if (values.materialFineness !== undefined) return { ...values.materialFineness }
  const option = snapshot.fields
    .find((field) => field.id === 'fineness')
    ?.options?.find((option) => option.id === values.fineness)
  if (!option) return {}
  const candidates = (values.materialIds ?? []).filter(
    (id) => !option.metal || matchesMaterials(option, [id]),
  )
  return candidates.length === 1 ? { [candidates[0]]: option.id } : {}
}
