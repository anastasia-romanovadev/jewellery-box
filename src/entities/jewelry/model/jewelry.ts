export const JEWELRY_CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'ring', label: 'Кольца' },
  { id: 'earrings', label: 'Серьги' },
  { id: 'chain', label: 'Цепи' },
  { id: 'bracelet', label: 'Браслеты' },
  { id: 'brooch', label: 'Броши' },
  { id: 'other', label: 'Прочее' },
] as const

export type CategoryFilterId = string
