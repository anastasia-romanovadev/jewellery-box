import { useLayoutEffect, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { ACCENT_OPTIONS, type AccentTone } from '../../../shared/config/appearance'
import {
  readAppearanceCache,
  synchronizeAppearanceCache,
  type AppearanceSettings,
} from './appearance-cache'
import type { ThemeMode } from '../../../shared/config/appearance'

export function applyAppearance(themeMode: ThemeMode, accentTone: AccentTone) {
  const darkMode =
    themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const accent = ACCENT_OPTIONS.find((option) => option.value === accentTone) ?? ACCENT_OPTIONS[0]

  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  document.documentElement.dataset.mantineColorScheme = darkMode ? 'dark' : 'light'
  document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', darkMode ? '#191516' : '#f8f5f2')
  document.documentElement.style.setProperty('--accent', accent.accent)
  document.documentElement.style.setProperty(
    '--accent-soft',
    darkMode ? `color-mix(in srgb, ${accent.accent} 30%, #221d1f)` : accent.accentSoft,
  )
  document.documentElement.style.setProperty('--accent-strong', accent.accentStrong)
}

export function initializeAppearance() {
  const { themeMode, accentTone } = readAppearanceCache()
  applyAppearance(themeMode, accentTone)
}

export function useAppearanceSettings() {
  const [settings, setSettings] = useState(readAppearanceCache)
  const [saveFailed, setSaveFailed] = useState(false)
  const { themeMode, accentTone } = settings
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', undefined, {
    getInitialValueInEffect: false,
  })
  const colorScheme: 'light' | 'dark' =
    themeMode === 'dark' || (themeMode === 'system' && systemDark) ? 'dark' : 'light'
  function updateSettings(update: Partial<AppearanceSettings>) {
    const next = { ...settings, ...update }
    setSettings(next)
    setSaveFailed(!synchronizeAppearanceCache(next))
  }
  useLayoutEffect(() => {
    applyAppearance(colorScheme, accentTone)
  }, [colorScheme, accentTone])
  return {
    colorScheme,
    themeMode,
    setThemeMode: (value: ThemeMode) => updateSettings({ themeMode: value }),
    accentTone,
    setAccentTone: (value: AccentTone) => updateSettings({ accentTone: value }),
    saveFailed,
    retrySave: () => setSaveFailed(!synchronizeAppearanceCache(settings)),
  }
}
