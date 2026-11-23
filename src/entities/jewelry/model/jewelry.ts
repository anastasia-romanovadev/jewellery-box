import { JEWELRY_TYPES } from '../../template/model/jewelry-types'

export const JEWELRY_CATEGORIES = [{ id: 'all', label: 'Все' }, ...JEWELRY_TYPES] as const

export type CategoryFilterId = string
