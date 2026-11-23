import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupPanel } from './BackupPanel'
import { canNavigate } from '../../../shared/lib/navigation-guard'

const api = vi.hoisted(() => ({ inspect: vi.fn(), restore: vi.fn(), export: vi.fn() }))
vi.mock('../../../data/backup-repository', () => ({
  inspectBackup: api.inspect,
  restoreBackup: api.restore,
  exportBackup: api.export,
}))

beforeEach(() => {
  api.inspect.mockReset().mockResolvedValue({
    summary: { exportedAt: '2026-11-23T00:00:00.000Z', items: 4, photos: 8, totalBytes: 100 },
  })
  api.restore.mockReset().mockResolvedValue(undefined)
  api.export.mockReset()
})

async function openPreview() {
  render(
    <MantineProvider>
      <BackupPanel />
    </MantineProvider>,
  )
  fireEvent.change(screen.getByLabelText('Файл резервной копии'), {
    target: { files: [new File(['test'], 'backup.zip', { type: 'application/zip' })] },
  })
  expect(await screen.findByRole('dialog')).toHaveTextContent('украшений — 4, фотографий — 8')
}

describe('backup confirmation', () => {
  it('checks the file without restoring and allows cancellation', async () => {
    await openPreview()
    expect(api.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.restore).not.toHaveBeenCalled()
  })

  it('retains the checked preview after a write failure and can retry', async () => {
    api.restore.mockRejectedValueOnce(new Error('Не хватает места'))
    await openPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Заменить данные и восстановить' }))
    expect(await screen.findByText('Не хватает места')).toBeVisible()
    expect(screen.getByRole('dialog')).toHaveTextContent('украшений — 4')
    fireEvent.click(screen.getByRole('button', { name: 'Заменить данные и восстановить' }))
    expect(await screen.findByText('Шкатулка восстановлена из резервной копии.')).toBeVisible()
    expect(api.restore).toHaveBeenCalledTimes(2)
  })

  it('blocks cancellation and navigation while restoration is in progress', async () => {
    let finish: (() => void) | undefined
    api.restore.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    await openPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Заменить данные и восстановить' }))
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled()
    expect(canNavigate()).toBe(false)
    finish?.()
    await screen.findByText('Шкатулка восстановлена из резервной копии.')
    expect(canNavigate()).toBe(true)
  })
})
