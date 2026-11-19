import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

let systemDark = false
let mobileViewport = false

export function setMobileViewport(mobile: boolean) {
  mobileViewport = mobile
}
const mediaListeners = new Set<EventListenerOrEventListenerObject>()

class MockResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

export function setSystemColorScheme(dark: boolean) {
  systemDark = dark
  const event = new Event('change') as MediaQueryListEvent
  Object.defineProperty(event, 'matches', { value: dark })

  for (const listener of mediaListeners) {
    if (typeof listener === 'function') listener(event)
    else listener.handleEvent(event)
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: MockResizeObserver,
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((media: string): MediaQueryList => ({
    get matches() {
      return media === '(prefers-color-scheme: dark)'
        ? systemDark
        : media === '(max-width: 920px)' && mobileViewport
    },
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (media === '(prefers-color-scheme: dark)') mediaListeners.add(listener)
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      mediaListeners.delete(listener)
    },
    dispatchEvent: vi.fn(),
  })),
})

beforeEach(() => {
  systemDark = false
  mobileViewport = false
  mediaListeners.clear()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
