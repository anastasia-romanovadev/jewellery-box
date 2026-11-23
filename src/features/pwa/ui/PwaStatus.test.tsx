import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PwaStatus } from './PwaStatus'
import { BEFORE_NAVIGATE } from '../../../shared/lib/navigation-guard'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('never activates a waiting worker automatically and honors the navigation guard', async () => {
  vi.stubEnv('PROD', true)
  const postMessage = vi.fn()
  const worker = { postMessage }
  const registration = {
    active: {},
    waiting: worker,
    installing: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const serviceWorker = {
    register: vi.fn().mockResolvedValue(registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('navigator', { serviceWorker })
  const view = render(
    <MantineProvider>
      <PwaStatus allowUpdate={false} />
    </MantineProvider>,
  )
  const button = await screen.findByRole('button', { name: 'Обновить приложение' })
  expect(button).toBeDisabled()
  expect(postMessage).not.toHaveBeenCalled()
  view.rerender(
    <MantineProvider>
      <PwaStatus allowUpdate />
    </MantineProvider>,
  )
  const block = (event: Event) => event.preventDefault()
  window.addEventListener(BEFORE_NAVIGATE, block)
  fireEvent.click(button)
  expect(postMessage).not.toHaveBeenCalled()
  window.removeEventListener(BEFORE_NAVIGATE, block)
  fireEvent.click(button)
  expect(postMessage).toHaveBeenCalledWith({ type: 'ACTIVATE_WHEN_ALONE' }, expect.any(Array))
})
