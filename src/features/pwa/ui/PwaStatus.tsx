import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import { canNavigate } from '../../../shared/lib/navigation-guard'

export function PwaStatus({ allowUpdate }: { allowUpdate: boolean }) {
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const updating = useRef(false)
  const [ready, setReady] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let stopped = false
    const cleanups: (() => void)[] = []
    const fail = () => {
      if (!stopped)
        setError(
          'Не удалось подготовить работу без сети. Подключись к интернету и перезагрузи приложение после сохранения изменений.',
        )
    }
    function onControllerChange() {
      // Another tab may activate an update; only the tab that requested it reloads.
      if (updating.current) window.location.reload()
      else if (!stopped) {
        setReady(true)
        setWaiting(false)
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((value) => {
        if (stopped) return
        registration.current = value
        setReady(Boolean(value.active))
        setWaiting(Boolean(value.waiting))
        const watch = () => {
          const worker = value.installing
          if (!worker) return
          const changed = () => {
            if (stopped) return
            if (worker.state === 'installed') {
              setWaiting(Boolean(navigator.serviceWorker.controller))
              if (!navigator.serviceWorker.controller) setReady(true)
            }
            if (worker.state === 'redundant') fail()
          }
          worker.addEventListener('statechange', changed)
          cleanups.push(() => worker.removeEventListener('statechange', changed))
        }
        value.addEventListener('updatefound', watch)
        cleanups.push(() => value.removeEventListener('updatefound', watch))
        watch()
        const check = () => {
          if (document.visibilityState === 'visible' && navigator.onLine)
            void value.update().catch(fail)
        }
        document.addEventListener('visibilitychange', check)
        cleanups.push(() => document.removeEventListener('visibilitychange', check))
      })
      .catch(fail)
    return () => {
      stopped = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  function update() {
    if (!allowUpdate) return
    const commit = () => {
      if (!registration.current?.waiting) return
      updating.current = true
      setUpdateError(null)
      const channel = new MessageChannel()
      const timeout = window.setTimeout(() => {
        channel.port1.close()
        updating.current = false
        setUpdateError('Не удалось начать обновление. Повтори попытку.')
      }, 5000)
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        window.clearTimeout(timeout)
        channel.port1.close()
        const data = event.data
        if (
          typeof data === 'object' &&
          data !== null &&
          'activated' in data &&
          data.activated === false
        ) {
          updating.current = false
          setUpdateError(
            'Сохрани изменения и закрой другие вкладки или окна «Шкатулки», затем повтори обновление.',
          )
        }
      }
      registration.current.waiting.postMessage({ type: 'ACTIVATE_WHEN_ALONE' }, [channel.port2])
    }
    if (canNavigate(commit)) commit()
  }

  if (!import.meta.env.PROD) return null
  if (error)
    return (
      <Alert role="alert" title="Работа без сети">
        {error}
      </Alert>
    )
  if (waiting)
    return (
      <Alert role="status" title="Доступна новая версия">
        {updateError && <p role="alert">{updateError}</p>}
        {allowUpdate
          ? 'Обновление перезапустит приложение. Сохранённая коллекция останется на месте.'
          : 'Сохрани изменения и вернись в коллекцию, чтобы обновить приложение.'}
        <Group mt="sm">
          <Button disabled={!allowUpdate} onClick={update}>
            Обновить приложение
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setWaiting(false)
              setDismissed(true)
            }}
          >
            Позже
          </Button>
        </Group>
      </Alert>
    )
  if (ready && !dismissed)
    return (
      <Alert
        role="status"
        title="Приложение готово к работе без сети"
        withCloseButton
        onClose={() => setDismissed(true)}
        closeButtonLabel="Скрыть сообщение о работе без сети"
      >
        Карточки, фотографии и настройки доступны без интернета. Для переноса и сохранности
        коллекции делай резервные копии.
      </Alert>
    )
  return null
}
