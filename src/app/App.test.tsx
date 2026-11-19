import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ACCENT_OPTIONS } from '../shared/config/appearance'
import {
  applyAppearance,
  initializeAppearance,
} from '../features/appearance-settings/model/useAppearanceSettings'
import { setMobileViewport, setSystemColorScheme } from '../test/setup'
import './styles/global.scss'
import { App } from './App'

function renderApp() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

function contrastRatio(foreground: string, background: string) {
  function luminance(color: string) {
    const channels = color.match(/[a-f\d]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255)
    if (!channels || channels.length !== 3) {
      throw new Error(`Expected a hex color, received "${color}".`)
    }

    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }

  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

describe('foundation app', () => {
  it('keeps text and controls readable in all six theme/accent combinations', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const accent of ACCENT_OPTIONS) {
        applyAppearance(theme, accent.value)

        const styles = getComputedStyle(document.documentElement)
        const foreground = styles.getPropertyValue('--fg').trim()
        const background = styles.getPropertyValue('--bg').trim()
        const surface = styles.getPropertyValue('--surface').trim()
        const focus = styles.getPropertyValue('--focus').trim()

        expect(styles.getPropertyValue('--accent').trim()).toBe(accent.accent)
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(foreground, surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio('#ffffff', accent.accent)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(focus, surface)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('filters the demo collection by category', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Серьги' }))

    expect(screen.getByText('Серьги «Лепесток»')).toBeInTheDocument()
    expect(screen.queryByText('Кольцо «Роза»')).not.toBeInTheDocument()
  })

  it('uses hash routes so settings can be opened on a static host', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))

    await waitFor(() => expect(window.location.hash).toBe('#/settings'))
    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument()
  })

  it('opens a settings hash URL directly', async () => {
    window.history.replaceState(null, '', '/#/settings')
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument()
  })

  it('opens the mobile navigation and closes it with Escape', async () => {
    setMobileViewport(true)
    const { container } = renderApp()

    const menuButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Открыть меню"]',
    )
    if (!menuButton) throw new Error('The mobile menu button is missing from the app shell.')
    menuButton.focus()
    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('main')).toHaveAttribute('inert')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Закрыть меню' })).toHaveFocus())

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(menuButton).toHaveFocus())
    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
  })

  it('keeps installation instructions available in settings after dismissal', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть инструкцию установки' }))
    expect(screen.queryByText('Как установить на телефон')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    await screen.findByRole('heading', { name: 'Настройки' })
    expect(screen.getByText('Как установить на телефон')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Коллекция' }))
    await screen.findByRole('heading', { name: 'Личная шкатулка' })
    expect(screen.queryByText('Как установить на телефон')).not.toBeInTheDocument()
  })

  it('applies and persists manual theme settings', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    await screen.findByRole('heading', { name: 'Настройки' })
    fireEvent.click(screen.getByRole('radio', { name: 'Тёмная' }))

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(window.localStorage.getItem('jewellery-box:theme-mode')).toBe('dark')
    })
  })

  it('restores legacy JSON-encoded appearance settings', async () => {
    window.localStorage.setItem('jewellery-box:theme-mode', '"dark"')
    renderApp()

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(document.documentElement.dataset.mantineColorScheme).toBe('dark')
  })

  it('falls back to the device theme when localStorage is unavailable', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError')
    })

    initializeAppearance()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#7a304a')
    expect(warning).toHaveBeenCalled()
  })

  it('follows operating-system theme changes while system mode is selected', async () => {
    renderApp()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))

    setSystemColorScheme(true)
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(document.documentElement.dataset.mantineColorScheme).toBe('dark')
  })

  it('shows a themed field, button, accessible error, and dialog preview', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    await screen.findByRole('heading', { name: 'Настройки' })

    expect(screen.getByRole('textbox', { name: 'Название украшения' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка сохранения')

    fireEvent.click(screen.getByRole('button', { name: 'Открыть диалог' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Пример диалога')
    expect(screen.getByRole('button', { name: 'Закрыть диалог' })).toBeInTheDocument()
  })
})

describe('foundation regressions', () => {
  it('starts dark consistently and keeps a manual choice across system changes', async () => {
    setSystemColorScheme(true)
    renderApp()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.mantineColorScheme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    await screen.findByRole('heading', { name: 'Настройки' })
    fireEvent.click(screen.getByRole('radio', { name: 'Светлая' }))
    setSystemColorScheme(false)
    setSystemColorScheme(true)
    await waitFor(() => expect(document.documentElement.dataset.mantineColorScheme).toBe('light'))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
  it('reports failed saves and can retry without losing the chosen appearance', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
    await screen.findByRole('heading', { name: 'Настройки' })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Unavailable', 'QuotaExceededError')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зелёный' }))
    expect(screen.getByText('Настройки не сохранены')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Зелёный' })).toHaveAttribute('aria-pressed', 'true')
    save.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить сохранение' }))
    expect(screen.queryByText('Настройки не сохранены')).not.toBeInTheDocument()
    expect(localStorage.getItem('jewellery-box:accent-tone')).toBe('forest')
  })
  it('selects a category from settings and closes the mobile menu', async () => {
    setMobileViewport(true)
    window.history.replaceState(null, '', '/#/settings')
    renderApp()
    // jsdom does not evaluate responsive CSS media queries.
    const menu = screen.getByLabelText('Открыть меню', { selector: 'button' })
    menu.focus()
    fireEvent.click(menu)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Закрыть меню' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Серьги' }))
    await screen.findByText('Серьги «Лепесток»')
    expect(screen.queryByText('Кольцо «Роза»')).not.toBeInTheDocument()
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(menu).toHaveFocus())
  })
})
