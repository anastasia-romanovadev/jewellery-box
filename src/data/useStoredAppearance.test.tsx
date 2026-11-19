import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { database } from './database'
import * as repository from './catalog-repository'
import { useStoredAppearance } from './useStoredAppearance'

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

beforeEach(async () => {
  // fake-indexeddb is imported above; this singleton cannot touch a browser profile.
  await database.delete()
  await database.open()
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await database.delete()
})

describe('stored appearance', () => {
  it('disables changes during initial loading, then uses canonical data over a stale cache', async () => {
    const first = await repository.getAppearance()
    await repository.saveAppearance({ themeMode: 'dark', accentTone: 'forest' }, first.revision)
    localStorage.setItem('jewellery-box:theme-mode', 'light')
    localStorage.setItem('jewellery-box:accent-tone', 'ochre')

    const { result } = renderHook(useStoredAppearance)
    expect(result.current.disabled).toBe(true)
    expect(result.current.loading).toBe(true)
    act(() => result.current.update({ themeMode: 'system' }))
    await waitFor(() =>
      expect({
        disabled: result.current.disabled,
        error: result.current.error,
        loading: result.current.loading,
      }).toEqual({ disabled: false, error: null, loading: false }),
    )

    expect(result.current.settings).toEqual({ themeMode: 'dark', accentTone: 'forest' })
    expect(localStorage.getItem('jewellery-box:theme-mode')).toBe('dark')
    expect(localStorage.getItem('jewellery-box:accent-tone')).toBe('forest')
  })

  it('does not roll back a successful database save when localStorage fails', async () => {
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.disabled).toBe(false))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cache = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Cache unavailable', 'SecurityError')
    })
    act(() => result.current.update({ themeMode: 'dark', accentTone: 'forest' }))
    await waitFor(() => expect(result.current.saving).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.cacheFailed).toBe(true)
    expect(await repository.getAppearance()).toMatchObject({
      themeMode: 'dark',
      accentTone: 'forest',
    })
    cache.mockRestore()
    act(() => result.current.retryCache())
    expect(result.current.cacheFailed).toBe(false)
    expect(localStorage.getItem('jewellery-box:theme-mode')).toBe('dark')
  })

  it('retains a failed draft and retries the same selection without altering prior database data', async () => {
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.disabled).toBe(false))
    const prior = await repository.getAppearance()
    const write = vi.spyOn(database.settings, 'put').mockImplementation(() => {
      throw new DOMException('Quota exhausted', 'QuotaExceededError')
    })

    act(() => result.current.update({ accentTone: 'ochre' }))
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.settings.accentTone).toBe('ochre')
    expect(result.current.saving).toBe(false)
    expect(await repository.getAppearance()).toEqual(prior)

    write.mockRestore()
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.error).toBeNull())
    await waitFor(() => expect(result.current.saving).toBe(false))
    expect(await repository.getAppearance()).toMatchObject({
      accentTone: 'ochre',
      revision: prior.revision + 1,
    })
  })

  it('protects a failed local draft from remote updates and reports a revision conflict on retry', async () => {
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.disabled).toBe(false))
    const prior = await repository.getAppearance()
    const write = vi.spyOn(database.settings, 'put').mockImplementation(() => {
      throw new DOMException('Quota exhausted', 'QuotaExceededError')
    })
    act(() => result.current.update({ accentTone: 'ochre' }))
    await waitFor(() => expect(result.current.error).not.toBeNull())
    write.mockRestore()

    await act(async () => {
      await repository.saveAppearance({ themeMode: 'dark', accentTone: 'forest' }, prior.revision)
    })
    expect(result.current.settings.accentTone).toBe('ochre')
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.error).toContain('другой вкладке'))
    expect(await repository.getAppearance()).toMatchObject({
      themeMode: 'dark',
      accentTone: 'forest',
    })
    expect(result.current.settings.accentTone).toBe('ochre')

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.disabled).toBe(false))
    expect(result.current.settings).toEqual({ themeMode: 'dark', accentTone: 'forest' })
    expect(result.current.error).toBeNull()
  })

  it('blocks a second rapid change until the first write has completed', async () => {
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.disabled).toBe(false))
    const prior = await repository.getAppearance()
    const gate = deferred()
    const originalSave = repository.saveAppearance
    const save = vi.spyOn(repository, 'saveAppearance').mockImplementation(async (...args) => {
      await gate.promise
      return originalSave(...args)
    })

    act(() => {
      result.current.update({ themeMode: 'dark' })
      result.current.update({ accentTone: 'forest' })
    })
    expect(result.current.disabled).toBe(true)
    expect(result.current.settings).toEqual({ themeMode: 'dark', accentTone: prior.accentTone })
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => {
      gate.release()
      await gate.promise
    })
    await waitFor(() => expect(result.current.disabled).toBe(false))
    expect(await repository.getAppearance()).toMatchObject({
      themeMode: 'dark',
      revision: prior.revision + 1,
    })
  })

  it('receives remote changes while there is no local draft', async () => {
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.disabled).toBe(false))
    const prior = await repository.getAppearance()
    await act(async () => {
      await repository.saveAppearance({ themeMode: 'dark', accentTone: 'forest' }, prior.revision)
    })
    await waitFor(() =>
      expect(result.current.settings).toEqual({ themeMode: 'dark', accentTone: 'forest' }),
    )
    expect(localStorage.getItem('jewellery-box:accent-tone')).toBe('forest')
  })

  it('reconciles a newer remote revision received before a local save promise resolves', async () => {
    const observedRevisions: number[] = []
    const originalRead = repository.readAppearance
    vi.spyOn(repository, 'readAppearance').mockImplementation(async (...args) => {
      const record = await originalRead(...args)
      observedRevisions.push(record.revision)
      return record
    })
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.disabled).toBe(false))
    const prior = await repository.getAppearance()
    const gate = deferred()
    const originalSave = repository.saveAppearance
    vi.spyOn(repository, 'saveAppearance').mockImplementation(async (...args) => {
      const record = await originalSave(...args)
      // Model a local commit whose promise returns after another tab commits.
      await gate.promise
      return record
    })

    act(() => result.current.update({ themeMode: 'dark' }))
    await waitFor(async () => {
      expect((await repository.getAppearance()).revision).toBe(prior.revision + 1)
    })
    const remote = await originalSave(
      { themeMode: 'light', accentTone: 'forest' },
      prior.revision + 1,
    )
    await waitFor(() => expect(observedRevisions).toContain(remote.revision))
    expect(result.current.saving).toBe(true)

    await act(async () => {
      gate.release()
      await gate.promise
    })
    await waitFor(() => expect(result.current.saving).toBe(false))
    await waitFor(() =>
      expect(result.current.settings).toEqual({ themeMode: 'light', accentTone: 'forest' }),
    )
    expect(localStorage.getItem('jewellery-box:accent-tone')).toBe('forest')
    expect(await repository.getAppearance()).toEqual(remote)
  })

  it('can recover from an initial database read failure without allowing an unsaved edit', async () => {
    const read = vi
      .spyOn(repository, 'readAppearance')
      .mockRejectedValue(new DOMException('Unavailable', 'SecurityError'))
    const { result } = renderHook(useStoredAppearance)
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.disabled).toBe(true)
    act(() => result.current.update({ themeMode: 'dark' }))
    expect(result.current.settings.themeMode).toBe('system')
    read.mockRestore()

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.disabled).toBe(false))
    expect(result.current.error).toBeNull()
  })
})
