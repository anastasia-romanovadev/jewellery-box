import { useEffect, useState } from 'react'
import { liveQuery, type Subscription } from 'dexie'
import { initializeDatabase, readCatalog, storageErrorMessage } from './catalog-repository'

type Catalog = Awaited<ReturnType<typeof readCatalog>>

export function useCatalog() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    catalog: Catalog | undefined
    error: string | null
    loading: boolean
  }>({ catalog: undefined, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    let subscription: Subscription | undefined
    const fail = (reason: unknown) => {
      if (!cancelled)
        setState((previous) => ({
          ...previous,
          error: storageErrorMessage(reason),
          loading: false,
        }))
    }
    void initializeDatabase()
      .then(() => {
        if (cancelled) return
        subscription = liveQuery(async () => {
          try {
            return { catalog: await readCatalog(), error: null }
          } catch (reason) {
            return { catalog: undefined, error: storageErrorMessage(reason) }
          }
        }).subscribe({
          next: (result) => {
            if (!cancelled)
              setState((previous) => ({
                // Keep editors mounted with their drafts while storage is unavailable.
                catalog: result.catalog ?? previous.catalog,
                error: result.error,
                loading: false,
              }))
          },
          error: fail,
        })
      })
      .catch(fail)
    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [attempt])

  return {
    ...state,
    retry: () => {
      setState((previous) => ({ ...previous, error: null, loading: true }))
      setAttempt((value) => value + 1)
    },
  }
}
