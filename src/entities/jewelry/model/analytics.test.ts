import { describe, expect, it } from 'vitest'
import { analyzeCollection, collectionFacts } from './analytics'
import type { JewelryItem } from './item'
import {
  buildCardSnapshot,
  DEFAULT_DICTIONARIES,
  DEFAULT_TEMPLATE,
} from '../../template/model/template'

function item(overrides: Partial<JewelryItem> = {}): JewelryItem {
  return {
    id: crypto.randomUUID(),
    revision: 1,
    typeId: 'ring',
    snapshot: buildCardSnapshot(DEFAULT_TEMPLATE, DEFAULT_DICTIONARIES, 'ring'),
    materialIds: ['gold-white'],
    materialFineness: { 'gold-white': 'fineness-gold-585' },
    weightGrams: 10,
    stoneIds: [],
    photoIds: [],
    notes: '',
    customValues: {},
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...overrides,
  }
}

describe('collection analytics', () => {
  it('counts combined gold colors once but excludes mixed metals', () => {
    const renamed = item({ weightGrams: 5 })
    renamed.snapshot.materials.find((option) => option.id === 'gold-white')!.label = 'Любимое'
    const stats = analyzeCollection([
      renamed,
      item({
        materialIds: ['gold-red'],
        materialFineness: { 'gold-red': 'fineness-gold-750' },
        weightGrams: 7,
      }),
      item({
        materialIds: ['gold-yellow'],
        materialFineness: { 'gold-yellow': 'fineness-gold-585' },
        weightGrams: 3,
      }),
      item({ materialIds: ['gold-white', 'silver'], weightGrams: 100 }),
      item({ materialIds: ['gold-white', 'gold-red'], weightGrams: 200 }),
      item({ weightGrams: undefined }),
      item({ materialIds: ['custom'], weightGrams: 400 }),
    ])
    expect(stats.metals.gold.weight).toBe(215)
    expect(stats.metals.gold.count).toBe(4)
    expect(stats.metals.gold.missingWeight).toBe(1)
    expect(stats.multipleMaterials).toBe(1)
    expect(stats.otherMaterials).toBe(1)
    expect(stats.metals.gold.byFineness.find((group) => group.id === '585')?.weight).toBe(8)
    expect(stats.metals.gold.byFineness.find((group) => group.id === '750')?.weight).toBe(7)
    expect(stats.metals.silver.weight).toBe(0)
  })

  it('keeps chart totals equal for legacy, custom, missing assays and fractional weights', () => {
    const custom = item({ materialFineness: { 'gold-white': 'historical' }, weightGrams: 0.1 })
    custom.snapshot.fields
      .find((field) => field.id === 'fineness')!
      .options!.push({ id: 'historical', label: '583' })
    const pendant = item({
      typeId: 'pendant',
      snapshot: buildCardSnapshot(DEFAULT_TEMPLATE, DEFAULT_DICTIONARIES, 'pendant'),
      weightGrams: 0.2,
    })
    const { gold } = analyzeCollection([
      custom,
      pendant,
      item({ materialFineness: undefined, finenessId: 'fineness-gold-585', weightGrams: 4 }),
      item({ materialFineness: {}, weightGrams: 2 }),
    ]).metals
    expect(gold.weight).toBeCloseTo(6.3)
    expect(gold.byFineness.reduce((sum, group) => sum + group.weight, 0)).toBeCloseTo(gold.weight)
    expect(gold.byType.reduce((sum, group) => sum + group.weight, 0)).toBeCloseTo(gold.weight)
    expect(gold.byFineness.find((group) => group.label === 'Не указана')?.weight).toBe(2)
    expect(gold.byFineness.find((group) => group.label === '583')?.weight).toBe(0.1)
    expect(gold.byType.find((group) => group.id === 'pendant')?.weight).toBe(0.2)
  })

  it('groups matching gold assays together and keeps differing or incomplete assays separate', () => {
    const materials = ['gold-white', 'gold-red', 'gold-yellow']
    const stats = analyzeCollection([
      item({
        materialIds: materials,
        weightGrams: 12,
        materialFineness: {
          'gold-white': 'fineness-gold-585',
          'gold-red': 'fineness-gold-585',
          'gold-yellow': 'fineness-gold-585',
        },
      }),
      item({
        materialIds: ['gold-white', 'gold-red'],
        weightGrams: 8,
        materialFineness: {
          'gold-white': 'fineness-gold-585',
          'gold-red': 'fineness-gold-750',
        },
      }),
      item({ materialIds: materials, weightGrams: 3 }),
      item({
        materialIds: materials,
        weightGrams: 4,
        materialFineness: undefined,
        finenessId: 'fineness-gold-585',
      }),
      item({ materialIds: materials, weightGrams: undefined }),
      item({ materialIds: ['gold-white', 'custom'], weightGrams: 100 }),
      item({ materialIds: ['gold-white', 'platinum'], weightGrams: 200 }),
    ])
    expect(stats.metals.gold.weight).toBe(27)
    expect(stats.metals.gold.count).toBe(4)
    expect(stats.metals.gold.missingWeight).toBe(1)
    expect(stats.multipleMaterials).toBe(2)
    expect(stats.metals.gold.byFineness.find((group) => group.label === '585')?.weight).toBe(12)
    expect(
      stats.metals.gold.byFineness.find((group) => group.label === 'Несколько проб')?.weight,
    ).toBe(8)
    expect(stats.metals.gold.byFineness.find((group) => group.label === 'Не указана')?.weight).toBe(
      7,
    )
    for (const groups of [stats.metals.gold.byFineness, stats.metals.gold.byType]) {
      expect(groups.reduce((sum, group) => sum + group.weight, 0)).toBe(27)
    }
    expect(collectionFacts(stats)[0]).toContain('27 г')
  })

  it('keeps silver and platinum separate, with zero bars for unrepresented assays', () => {
    const { metals } = analyzeCollection([
      item({
        materialIds: ['silver'],
        materialFineness: { silver: 'fineness-silver-999' },
        weightGrams: 12,
      }),
      item({
        materialIds: ['platinum'],
        materialFineness: { platinum: 'fineness-platinum-999' },
        weightGrams: 8,
      }),
    ])
    expect(metals.silver.byFineness.find((group) => group.id === '999')?.weight).toBe(12)
    expect(metals.platinum.byFineness.find((group) => group.id === '999')?.weight).toBe(8)
    expect(metals.gold.weight).toBe(0)
    expect(metals.silver.byFineness.find((group) => group.id === '925')?.weight).toBe(0)
  })

  it('adds sidebar comments using the weight and count described by each fact', () => {
    const facts = collectionFacts(
      analyzeCollection([
        ...Array.from({ length: 10 }, () => item({ weightGrams: 5 })),
        item({ materialIds: ['silver'], weightGrams: 500 }),
        item({ materialIds: ['platinum'], weightGrams: 20 }),
      ]),
    )
    expect(facts[0]).toContain('Отличная работа!')
    expect(facts[2]).toContain('Маловато однако, ты точно всё записала?')
    expect(facts[3]).toContain('Отличная коллекция!')
    expect(facts[4]).toContain('Я отказываюсь комментировать это число.')
    const unknown = collectionFacts(analyzeCollection([item({ weightGrams: undefined })]))
    expect(unknown.join(' ')).not.toContain('Маловато однако')
    expect(unknown.join(' ')).not.toContain('Отличная работа!')
  })

  it('creates five distinct factual messages and handles empty/excluded collections', () => {
    const facts = collectionFacts(analyzeCollection([item()]))
    expect(new Set(facts).size).toBe(5)
    expect(facts[0]).toContain('10 г')
    expect(facts[1]).toContain('пока нет украшений с указанными камнями')
    expect(facts[3]).toContain('По весу лидируют: кольца. Их у тебя 1 шт., с общим весом 10 г!')
    expect(facts[4]).toContain('10 г')
    expect(collectionFacts(analyzeCollection([]))[0]).toContain('первое украшение')
    expect(
      collectionFacts(analyzeCollection([item({ materialIds: ['silver', 'gold-white'] })]))[4],
    ).toContain('Общий вес всех твоих украшений — 10 г.')
  })

  it('counts stones and category weights across the whole collection, including mixed materials', () => {
    const facts = collectionFacts(
      analyzeCollection([
        item({ weightGrams: 5, stoneIds: ['amethyst', 'topaz'] }),
        item({ weightGrams: 20, materialIds: ['gold-white', 'silver'], stoneIds: ['amethyst'] }),
        item({ typeId: 'pendant', weightGrams: 3, stoneIds: [] }),
      ]),
    )
    expect(facts[1]).toBe('В твоей шкатулке украшений с аметистом больше всего!')
    expect(facts[3]).toContain('По весу лидируют: кольца. Их у тебя 2 шт., с общим весом 25 г!')
    expect(facts[4]).toContain('Общий вес всех твоих украшений — 28 г.')
    expect(facts[0]).toContain('8 г')
  })

  it('handles ties, custom stone names and missing weights without inventing a winner or a complete total', () => {
    const first = item({ stoneIds: ['ruby'], weightGrams: 10 })
    const second = item({ typeId: 'pendant', stoneIds: ['topaz'], weightGrams: 10 })
    const tied = collectionFacts(analyzeCollection([first, second]))
    expect(tied[1]).toContain('одинаково часто')
    expect(tied[1]).toContain('«Рубин»')
    expect(tied[1]).toContain('«Топаз»')
    expect(tied[3]).toContain('кольца, подвески. Их у тебя 2 шт., с общим весом 20 г!')
    first.snapshot.stones.find((stone) => stone.id === 'ruby')!.label = 'Розовый кварц'
    const partial = collectionFacts(analyzeCollection([first, item({ weightGrams: undefined })]))
    expect(partial[1]).toContain('с камнем «Розовый кварц»')
    expect(partial[3]).toContain('Их у тебя 2 шт., с общим указанным весом 10 г!')
    expect(partial[4]).toContain(
      'Общий указанный вес твоих украшений — 10 г. Вес не указан у украшений: 1.',
    )
  })
})
