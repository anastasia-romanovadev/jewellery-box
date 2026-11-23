import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Modal, Stack } from '@mantine/core'
import { readItemPhotos } from '../../../data/jewelry-repository'
import { downloadPhotoFile, photoArchive, photoFiles } from '../model/photo-export'
import classes from './JewelryDetails.module.scss'

type Props = { itemId: string; photoIds: string[]; currentId: string }

function PhotoSaveOptions({
  itemId,
  photoIds,
  currentId,
  onBusyChange,
  onSaved,
}: Props & { onBusyChange: (busy: boolean) => void; onSaved: () => void }) {
  const [files, setFiles] = useState<File[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const active = useRef(true)
  const running = useRef(false)
  useEffect(() => {
    active.current = true
    let cancelled = false
    void readItemPhotos(itemId, photoIds)
      .then((photos) => {
        if (!cancelled) setFiles(photoFiles(photos))
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить фотографии. Попробуй ещё раз.')
      })
    return () => {
      cancelled = true
      active.current = false
    }
  }, [itemId, photoIds, attempt])

  const current = files?.[photoIds.indexOf(currentId)]
  function canShare(selected: File[]) {
    return (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: selected })
    )
  }
  async function save(all: boolean, downloadOnly = false) {
    if (!files || !current || running.current) return
    const selected = all ? files : [current]
    running.current = true
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      // Files are ready before this click, preserving the activation required by Web Share.
      if (!downloadOnly && canShare(selected)) await navigator.share({ files: selected })
      else {
        const blob = all ? await photoArchive(selected) : current
        if (active.current) downloadPhotoFile(blob, all ? 'jewellery-photos.zip' : current.name)
      }
      if (active.current) onSaved()
    } catch (reason) {
      if (active.current && !(reason instanceof DOMException && reason.name === 'AbortError'))
        setError('Не удалось сохранить фотографии. Попробуй ещё раз или скачай их по одной.')
    } finally {
      running.current = false
      if (active.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }
  return (
    <div className={classes.photoSaveOptions}>
      {error && (
        <Alert role="alert" color="red">
          {error}
          {!files && (
            <Button
              variant="default"
              onClick={() => {
                setError(null)
                setAttempt((value) => value + 1)
              }}
            >
              Повторить загрузку фото
            </Button>
          )}
        </Alert>
      )}
      {!files && !error && <p role="status">Подготавливаю оригиналы…</p>}
      <Stack gap="sm">
        <Button variant="default" disabled={!current || busy} onClick={() => void save(false)}>
          Сохранить это фото
        </Button>
        <Button variant="default" disabled={!current || busy} onClick={() => void save(true)}>
          Сохранить все фото ({photoIds.length})
        </Button>
      </Stack>
      <p>
        Оригиналы сохраняются без изменения качества.{' '}
        {files && canShare(files)
          ? 'В системном меню выбери сохранение изображений.'
          : 'Одно фото скачивается отдельным файлом, все фото — одним ZIP-архивом.'}
      </p>
      {files && current && (canShare(files) || canShare([current])) && (
        <details>
          <summary>Скачать вместо системного меню</summary>
          <Group>
            <Button
              variant="subtle"
              color="var(--accent)"
              disabled={busy || !current}
              onClick={() => void save(false, true)}
            >
              Скачать текущее файлом
            </Button>
            <Button
              variant="subtle"
              color="var(--accent)"
              disabled={busy}
              onClick={() => void save(true, true)}
            >
              Скачать все ZIP-архивом
            </Button>
          </Group>
        </details>
      )}
      {busy && <p role="status">Сохраняю фотографии…</p>}
    </div>
  )
}

export function PhotoSaveMenu({
  opened,
  onClose,
  onAfterClose,
  ...props
}: Props & { opened: boolean; onClose: () => void; onAfterClose: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      stackId="jewelry-photo-save"
      returnFocus={false}
      onExitTransitionEnd={onAfterClose}
      opened={opened}
      onClose={() => {
        if (!busy) onClose()
      }}
      title="Сохранить фотографии"
      centered
      size="sm"
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      closeButtonProps={{ 'aria-label': 'Закрыть сохранение фото', disabled: busy }}
    >
      {opened && (
        <PhotoSaveOptions
          key={JSON.stringify([props.itemId, props.photoIds])}
          {...props}
          onBusyChange={setBusy}
          onSaved={onClose}
        />
      )}
    </Modal>
  )
}
