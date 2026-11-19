import {
  APPEARANCE_STORAGE_KEYS,
  DEFAULT_APPEARANCE,
  isAccentTone,
  isThemeMode,
  type AccentTone,
  type ThemeMode,
} from '../config/appearance'
import { readStorage, writeStorage } from './browser-storage'

export type AppearanceSettings = {
  themeMode: ThemeMode
  accentTone: AccentTone
}

function readSetting<T extends string>(
  key: string,
  isValid: (value: string) => value is T,
  fallback: T,
): T {
  const value = readStorage(key)
  if (!value) return fallback
  if (isValid(value)) return value

  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' && isValid(parsed) ? parsed : fallback
  } catch {
    // Invalid optional cache data falls back without modifying canonical settings.
    return fallback
  }
}

export function readAppearanceCache(): AppearanceSettings {
  return {
    themeMode: readSetting(
      APPEARANCE_STORAGE_KEYS.theme,
      isThemeMode,
      DEFAULT_APPEARANCE.themeMode,
    ),
    accentTone: readSetting(
      APPEARANCE_STORAGE_KEYS.accent,
      isAccentTone,
      DEFAULT_APPEARANCE.accentTone,
    ),
  }
}

export function synchronizeAppearanceCache(settings: AppearanceSettings): boolean {
  // The IndexedDB data layer calls this after its canonical read/write succeeds.
  const themeSaved = writeStorage(APPEARANCE_STORAGE_KEYS.theme, settings.themeMode)
  const accentSaved = writeStorage(APPEARANCE_STORAGE_KEYS.accent, settings.accentTone)
  return themeSaved && accentSaved
}
