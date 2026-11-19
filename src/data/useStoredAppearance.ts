import { useEffect, useRef, useState } from 'react'
import { liveQuery } from 'dexie'
import {
  readAppearanceCache,
  synchronizeAppearanceCache,
  type AppearanceSettings,
} from '../shared/lib/appearance-cache'
import {
  initializeDatabase,
  readAppearance,
  saveAppearance,
  storageErrorMessage,
} from './catalog-repository'
import type { AppearanceRecord } from './database'

export function useStoredAppearance() {
  const [settings, setSettings] = useState(readAppearanceCache)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheFailed, setCacheFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const confirmed = useRef<AppearanceRecord | null>(null)
  const latestObserved = useRef<AppearanceRecord | null>(null)
  const draft = useRef(settings)
  const dirty = useRef(false)
  const busy = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    let subscription: { unsubscribe: () => void } | undefined
    void initializeDatabase()
      .then(() => {
        if (cancelled) return
        subscription = liveQuery(() => readAppearance()).subscribe({
          next(record) {
            if (!latestObserved.current || record.revision >= latestObserved.current.revision)
              latestObserved.current = record
            if (confirmed.current && record.revision < confirmed.current.revision) return
            // A remote update must not replace a failed local draft or an in-flight edit.
            if (dirty.current || busy.current) return
            confirmed.current = record
            const value = { themeMode: record.themeMode, accentTone: record.accentTone }
            draft.current = value
            setSettings(value)
            setCacheFailed(!synchronizeAppearanceCache(value))
            setLoading(false)
            setError(null)
          },
          error(reason: unknown) {
            setError(storageErrorMessage(reason))
            setLoading(false)
          },
        })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(storageErrorMessage(reason))
        setLoading(false)
      })
    return () => {
      cancelled = true
      mounted.current = false
      subscription?.unsubscribe()
    }
  }, [attempt])

  async function persist(value: AppearanceSettings) {
    if (busy.current || !confirmed.current) return
    busy.current = true
    dirty.current = true
    setSaving(true)
    setError(null)
    try {
      const record = await saveAppearance(value, confirmed.current.revision)
      const canonical =
        latestObserved.current && latestObserved.current.revision > record.revision
          ? latestObserved.current
          : record
      confirmed.current = canonical
      dirty.current = false
      const applied = { themeMode: canonical.themeMode, accentTone: canonical.accentTone }
      draft.current = applied
      if (mounted.current) {
        setSettings(applied)
        setCacheFailed(!synchronizeAppearanceCache(applied))
      }
    } catch (reason) {
      if (mounted.current) setError(storageErrorMessage(reason))
    } finally {
      busy.current = false
      if (mounted.current) setSaving(false)
    }
  }

  function update(update: Partial<AppearanceSettings>) {
    if (loading || busy.current || !confirmed.current) return
    const value = { ...draft.current, ...update }
    draft.current = value
    setSettings(value)
    void persist(value)
  }

  function reload() {
    if (busy.current) return
    dirty.current = false
    confirmed.current = null
    latestObserved.current = null
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  return {
    settings,
    loading,
    saving,
    error,
    cacheFailed,
    disabled: loading || saving || !confirmed.current,
    update,
    reload,
    retry: () => {
      if (confirmed.current) void persist(draft.current)
      else reload()
    },
    retryCache: () => {
      if (confirmed.current) setCacheFailed(!synchronizeAppearanceCache(confirmed.current))
    },
  }
}
