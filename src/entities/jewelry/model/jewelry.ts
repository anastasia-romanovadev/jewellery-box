export type JewelryCategory = 'Кольца' | 'Серьги' | 'Цепи' | 'Броши' | 'Прочее'

export type Jewelry = {
  id: string
  name: string
  category: JewelryCategory
  material: string
}

export const JEWELRY_CATEGORIES = ['Все', 'Кольца', 'Серьги', 'Цепи', 'Броши', 'Прочее'] as const

export const DEMO_JEWELRY: Jewelry[] = [
  { id: 'rose', name: 'Кольцо «Роза»', category: 'Кольца', material: 'Золото 18k' },
  { id: 'petal', name: 'Серьги «Лепесток»', category: 'Серьги', material: 'Серебро' },
  { id: 'ember', name: 'Цепочка «Янтарь»', category: 'Цепи', material: 'Жемчуг' },
  { id: 'forest', name: 'Брошь «Лес»', category: 'Броши', material: 'Медь' },
  { id: 'linen', name: 'Подвеска «Лён»', category: 'Прочее', material: 'Латунь' },
]
