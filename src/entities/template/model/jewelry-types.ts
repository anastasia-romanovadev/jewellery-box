import type { SizeKind } from './types'

export const JEWELRY_TYPES: { id: string; label: string; sizeKind: SizeKind }[] = [
  { id: 'ring', label: 'Кольца', sizeKind: 'ring' },
  { id: 'earrings', label: 'Серьги', sizeKind: 'earring' },
  { id: 'chain', label: 'Цепи', sizeKind: 'length' },
  { id: 'pendant', label: 'Подвески', sizeKind: 'none' },
  { id: 'bracelet', label: 'Браслеты', sizeKind: 'length' },
  { id: 'brooch', label: 'Броши', sizeKind: 'none' },
  { id: 'other', label: 'Прочее', sizeKind: 'none' },
]

export function sortJewelryTypes<T extends { id: string }>(types: T[]): T[] {
  const order = (id: string) => {
    const index = JEWELRY_TYPES.findIndex((type) => type.id === id)
    return index < 0 ? JEWELRY_TYPES.length : index
  }
  return [...types].sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id))
}
