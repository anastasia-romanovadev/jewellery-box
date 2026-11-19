export const JEWELRY_CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'ring', label: 'Кольца' },
  { id: 'earrings', label: 'Серьги' },
  { id: 'chain', label: 'Цепи' },
  { id: 'brooch', label: 'Броши' },
  { id: 'other', label: 'Прочее' },
] as const

// User-defined dictionary IDs are added at runtime.
export type CategoryFilterId = string
export type DemoJewelryTypeId = Exclude<(typeof JEWELRY_CATEGORIES)[number]['id'], 'all'>

// Presentation fixtures only: never seed the user's database with these records.
// Real cards use JewelleryItem with a schema snapshot and materialIds (task 02/03).
export type DemoJewelry = {
  id: string
  name: string
  typeId: DemoJewelryTypeId
  categoryLabel: string
  materialLabels: string[]
}

export const DEMO_JEWELRY: DemoJewelry[] = [
  {
    id: 'rose',
    name: 'Кольцо «Роза»',
    typeId: 'ring',
    categoryLabel: 'Кольца',
    materialLabels: ['Золото 18k'],
  },
  {
    id: 'petal',
    name: 'Серьги «Лепесток»',
    typeId: 'earrings',
    categoryLabel: 'Серьги',
    materialLabels: ['Серебро'],
  },
  {
    id: 'ember',
    name: 'Цепочка «Янтарь»',
    typeId: 'chain',
    categoryLabel: 'Цепи',
    materialLabels: ['Жемчуг'],
  },
  {
    id: 'forest',
    name: 'Брошь «Лес»',
    typeId: 'brooch',
    categoryLabel: 'Броши',
    materialLabels: ['Медь'],
  },
  {
    id: 'linen',
    name: 'Подвеска «Лён»',
    typeId: 'other',
    categoryLabel: 'Прочее',
    materialLabels: ['Латунь'],
  },
]
