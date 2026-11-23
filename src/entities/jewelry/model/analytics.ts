import type { JewelryItem } from './item'
import type { FinenessMetal } from '../../template/model/types'
import { FINENESS_METALS } from '../../template/model/dictionary-options'
import { JEWELRY_TYPES } from '../../template/model/jewelry-types'
import { materialMetal } from '../../template/model/material-fineness'
import { countComment, weightComment } from '../../../shared/config/playful-copy'

export const ANALYTICS_METALS: { value: FinenessMetal; label: string; genitive: string }[] = [
  { value: 'gold', label: 'Золото', genitive: 'золота' },
  { value: 'platinum', label: 'Платина', genitive: 'платины' },
  { value: 'silver', label: 'Серебро', genitive: 'серебра' },
]
export type WeightGroup = { id: string; label: string; weight: number }
export type MetalAnalysis = {
  weight: number
  count: number
  missingWeight: number
  byFineness: WeightGroup[]
  byType: WeightGroup[]
}
function emptyMetal(metal: FinenessMetal): MetalAnalysis {
  return {
    weight: 0,
    count: 0,
    missingWeight: 0,
    byFineness: (FINENESS_METALS.find((entry) => entry.value === metal)?.values ?? []).map(
      (label) => ({ id: label, label, weight: 0 }),
    ),
    byType: JEWELRY_TYPES.map(({ id, label }) => ({ id, label, weight: 0 })),
  }
}
function addWeight(groups: WeightGroup[], id: string, label: string, weight: number) {
  const existing = groups.find((group) => group.id === id)
  if (existing) existing.weight += weight
  else groups.push({ id, label, weight })
}

/** Full item weight, counted once; different gold colors still belong to one metal. */
export function analyzeCollection(items: JewelryItem[]) {
  const metals: Record<FinenessMetal, MetalAnalysis> = {
    gold: emptyMetal('gold'),
    platinum: emptyMetal('platinum'),
    silver: emptyMetal('silver'),
  }
  let multipleMaterials = 0
  let otherMaterials = 0
  const collection = {
    weight: 0,
    missingWeight: 0,
    types: [] as (WeightGroup & { count: number; missingWeight: number })[],
    stones: [] as { id: string; label: string; count: number; updatedAt: string }[],
  }
  for (const item of items) {
    collection.weight += item.weightGrams ?? 0
    collection.missingWeight += item.weightGrams === undefined ? 1 : 0
    let type = collection.types.find((group) => group.id === item.typeId)
    if (!type) {
      type = {
        id: item.typeId,
        label:
          JEWELRY_TYPES.find((entry) => entry.id === item.typeId)?.label ?? item.snapshot.typeLabel,
        weight: 0,
        count: 0,
        missingWeight: 0,
      }
      collection.types.push(type)
    }
    type.count++
    type.weight += item.weightGrams ?? 0
    type.missingWeight += item.weightGrams === undefined ? 1 : 0
    for (const id of new Set(item.stoneIds)) {
      const option = item.snapshot.stones.find((stone) => stone.id === id)
      if (!option) continue
      const stone = collection.stones.find((entry) => entry.id === id)
      if (stone) {
        stone.count++
        if (item.updatedAt > stone.updatedAt) {
          stone.label = option.label
          stone.updatedAt = item.updatedAt
        }
      } else
        collection.stones.push({ id, label: option.label, count: 1, updatedAt: item.updatedAt })
    }
    const allGold =
      item.materialIds.length > 0 && item.materialIds.every((id) => materialMetal(id) === 'gold')
    if (item.materialIds.length > 1 && !allGold) {
      multipleMaterials++
      continue
    }
    const materialId = item.materialIds[0]
    const metal = materialId ? materialMetal(materialId) : undefined
    if (!metal) {
      otherMaterials++
      continue
    }
    const stats = metals[metal]
    if (item.weightGrams === undefined) {
      stats.missingWeight++
      continue
    }
    stats.count++
    stats.weight += item.weightGrams
    addWeight(stats.byType, item.typeId, item.snapshot.typeLabel, item.weightGrams)
    const options = item.snapshot.fields.find((field) => field.id === 'fineness')?.options
    const assays = item.materialIds.map((id) => {
      const finenessId =
        item.materialFineness !== undefined
          ? item.materialFineness[id]
          : item.materialIds.length === 1
            ? item.finenessId
            : undefined
      const assay = options?.find((option) => option.id === finenessId)
      return assay && (!assay.metal || assay.metal === metal) ? assay.label : undefined
    })
    const label = assays.some((assay) => assay === undefined)
      ? 'Не указана'
      : new Set(assays).size > 1
        ? 'Несколько проб'
        : assays[0]!
    addWeight(stats.byFineness, label, label, item.weightGrams)
  }
  for (const stats of Object.values(metals)) {
    stats.byFineness.sort((a, b) => a.label.localeCompare(b.label, 'ru', { numeric: true }))
  }
  return { metals, multipleMaterials, otherMaterials, totalCount: items.length, collection }
}
export type CollectionAnalysis = ReturnType<typeof analyzeCollection>
export const formatGrams = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })

export function collectionFacts(analysis: CollectionAnalysis): string[] {
  if (!analysis.totalCount)
    return ['Добавь первое украшение — здесь появятся факты о твоей коллекции.']
  const { gold, silver, platinum } = analysis.metals
  const { types, stones, weight, missingWeight } = analysis.collection
  const maximum = Math.max(...types.map((group) => group.weight))
  const leaders = types.filter(
    (group) => group.weight > 0 && Math.abs(group.weight - maximum) < 1e-9,
  )
  const mostStones = Math.max(0, ...stones.map((stone) => stone.count))
  const leadingStones = stones
    .filter((stone) => stone.count === mostStones)
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  const instrumental: Record<string, string> = {
    бриллиант: 'бриллиантом',
    жемчуг: 'жемчугом',
    рубин: 'рубином',
    сапфир: 'сапфиром',
    изумруд: 'изумрудом',
    аметист: 'аметистом',
    топаз: 'топазом',
  }
  const stone = leadingStones[0]
  const stoneName = stone?.label.trim().toLocaleLowerCase('ru')
  const stoneText = !stone
    ? 'В твоей шкатулке пока нет украшений с указанными камнями.'
    : leadingStones.length > 1
      ? `В твоей шкатулке одинаково часто встречаются украшения с камнями: ${leadingStones.map((entry) => `«${entry.label}»`).join(', ')}!`
      : `В твоей шкатулке украшений с ${stoneName && Object.hasOwn(instrumental, stoneName) ? instrumental[stoneName] : `камнем «${stone.label}»`} больше всего!`
  const leaderCount = leaders.reduce((sum, group) => sum + group.count, 0)
  const leaderWeight = leaders.reduce((sum, group) => sum + group.weight, 0)
  const weightNote = missingWeight ? ` Вес не указан у украшений: ${missingWeight}.` : ''
  return [
    `Общий ${gold.missingWeight || silver.missingWeight ? 'указанный ' : ''}вес всех твоих украшений из золота составляет ${formatGrams(gold.weight)} г, а серебряных — ${formatGrams(silver.weight)} г.${gold.count ? ` ${weightComment(gold.weight)}` : ''}`,
    stoneText,
    `${platinum.missingWeight ? 'Указанный вес' : 'Вес'} всех платиновых украшений составляет ${formatGrams(platinum.weight)} г.${platinum.count ? ` ${weightComment(platinum.weight)}` : ''}`,
    leaders.length
      ? `По ${missingWeight ? 'указанному ' : ''}весу лидируют: ${leaders.map((group) => group.label.toLocaleLowerCase('ru')).join(', ')}. Их у тебя ${leaderCount} шт., с общим ${leaders.some((group) => group.missingWeight) ? 'указанным ' : ''}весом ${formatGrams(leaderWeight)} г! ${countComment(leaderCount)}`
      : 'Укажи вес украшений, чтобы узнать, какая категория лидирует!',
    `${missingWeight ? 'Общий указанный вес твоих' : 'Общий вес всех твоих'} украшений — ${formatGrams(weight)} г.${weightNote}${analysis.totalCount > missingWeight ? ` ${weightComment(weight)}` : ''}`,
  ]
}
