import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import type { MetalPrice } from '../entities/jewelry/model/pricing'
import { readMetalPrices } from './metal-price-repository'
import { readDataGeneration, storageErrorMessage } from './catalog-repository'
import { database } from './database'

export function useMetalPrices() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    prices: MetalPrice[]
    loading: boolean
    error: string | null
    generation: number
  }>({ prices: [], loading: true, error: null, generation: 0 })
  useEffect(() => {
    const subscription = liveQuery(() =>
      database.transaction('r', database.metalPrices, database.restoreState, async () => ({
        prices: await readMetalPrices(),
        generation: await readDataGeneration(),
      })),
    ).subscribe({
      next: (value) => setState({ ...value, loading: false, error: null }),
      error: (reason: unknown) =>
        setState((previous) => ({
          ...previous,
          loading: false,
          error: storageErrorMessage(reason),
        })),
    })
    return () => subscription.unsubscribe()
  }, [attempt])
  return {
    ...state,
    retry: () => {
      setState((previous) => ({ ...previous, loading: true, error: null }))
      setAttempt((value) => value + 1)
    },
  }
}
