export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentTone = 'burgundy' | 'forest' | 'ochre'

export type AccentOption = {
  label: string
  value: AccentTone
  accent: string
  accentSoft: string
  accentStrong: string
}

export const APPEARANCE_STORAGE_KEYS = {
  theme: 'jewellery-box:theme-mode',
  accent: 'jewellery-box:accent-tone',
} as const

export const DEFAULT_APPEARANCE = {
  themeMode: 'system',
  accentTone: 'burgundy',
} as const

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    label: 'Бордовый',
    value: 'burgundy',
    accent: '#7a304a',
    accentSoft: '#f7e7ed',
    accentStrong: '#5f2038',
  },
  {
    label: 'Зелёный',
    value: 'forest',
    accent: '#4f634d',
    accentSoft: '#edf3ec',
    accentStrong: '#394b38',
  },
  {
    label: 'Охра',
    value: 'ochre',
    accent: '#85551f',
    accentSoft: '#f8f0e4',
    accentStrong: '#694116',
  },
]

export const THEME_OPTIONS = [
  { label: 'Система', value: 'system' },
  { label: 'Светлая', value: 'light' },
  { label: 'Тёмная', value: 'dark' },
]

export function isThemeMode(value: string): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function isAccentTone(value: string): value is AccentTone {
  return ACCENT_OPTIONS.some((option) => option.value === value)
}
