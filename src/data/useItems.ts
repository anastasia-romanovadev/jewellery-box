import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { initializeDatabase, storageErrorMessage } from './catalog-repository'
import { readItems } from './jewelry-repository'
import type { JewelryItem } from '../entities/jewelry/model/item'

export function useItems() {
  const [items, setItems] = useState<JewelryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    let subscription: { unsubscribe: () => void } | undefined
    const fail = (reason: unknown) => {
      if (!cancelled) {
        setError(storageErrorMessage(reason))
        setLoading(false)
      }
    }
    void initializeDatabase()
      .then(() => {
        if (cancelled) return
        subscription = liveQuery(() => readItems()).subscribe({
          next: (value) => {
            if (!cancelled) {
              setItems(value)
              setLoading(false)
              setError(null)
            }
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
    items,
    error,
    loading,
    retry: () => {
      setLoading(true)
      setAttempt((value) => value + 1)
    },
  }
}
