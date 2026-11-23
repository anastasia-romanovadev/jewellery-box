import type { DictionaryEntry, DictionaryOption, FinenessMetal } from './types'

export const FINENESS_METALS: { value: FinenessMetal; label: string; values: string[] }[] = [
  { value: 'gold', label: 'Золото', values: ['375', '500', '585', '750', '958', '999'] },
  { value: 'silver', label: 'Серебро', values: ['800', '830', '875', '925', '960', '999'] },
  { value: 'platinum', label: 'Платина', values: ['585', '850', '900', '950', '999'] },
]

export function dictionaryOption(entry: DictionaryEntry): DictionaryOption {
  return {
    id: entry.id,
    label: entry.label,
    ...(entry.metal ? { metal: entry.metal } : {}),
    ...(entry.color ? { color: entry.color } : {}),
  }
}

export function finenessLabel(option: DictionaryOption): string {
  const metal = FINENESS_METALS.find((metal) => metal.value === option.metal)
  return metal ? `${option.label} · ${metal.label}` : option.label
}
