import { useRef, useState } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import type { NewPhoto } from '../../../entities/jewelry/model/item'
import { StoredPhoto } from '../../../entities/jewelry/ui/StoredPhoto'
import { preparePhotos } from '../model/photos'
import classes from './JewelryEditor.module.scss'

export function PhotoEditor({
  label,
  ids,
  added,
  disabled,
  error,
  onChange,
  onBusy,
}: {
  label: string
  ids: string[]
  added: NewPhoto[]
  disabled: boolean
  error?: string
  onChange: (ids: string[], added: NewPhoto[]) => void
  onBusy: (busy: boolean) => void
}) {
  const [failure, setFailure] = useState<string | null>(null)
  const busy = useRef(false)
  const galleryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  async function select(files: File[]) {
    if (!files.length || busy.current) return
    busy.current = true
    onBusy(true)
    setFailure(null)
    try {
      const photos = await preparePhotos(files, ids.length)
      onChange([...ids, ...photos.map((photo) => photo.id)], [...added, ...photos])
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : 'Не удалось добавить фото')
    } finally {
      busy.current = false
      onBusy(false)
    }
  }
  function move(index: number, target: number) {
    const next = [...ids]
    const [id] = next.splice(index, 1)
    next.splice(target, 0, id)
    onChange(next, added)
  }
  return (
    <section aria-label={label} className={classes.section}>
      <h3>
        {label} ({ids.length}/5)
      </h3>
      <p>Первое фото — обложка. Оригиналы сохраняются без сжатия.</p>
      {(error || failure) && (
        <Alert color="red" role="alert">
          {error || failure}
        </Alert>
      )}
      <Group>
        <Button
          type="button"
          variant="default"
          disabled={disabled}
          onClick={() => galleryInput.current?.click()}
        >
          Из галереи
        </Button>
        <input
          ref={galleryInput}
          hidden
          aria-label="Добавить фотографии из галереи"
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          onChange={(event) => {
            // Only successful preparation changes the draft, not the native file selection.
            event.stopPropagation()
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            void select(files)
          }}
        />
        <Button
          type="button"
          variant="default"
          disabled={disabled}
          onClick={() => cameraInput.current?.click()}
        >
          Снять фото
        </Button>
        <input
          ref={cameraInput}
          hidden
          aria-label="Снять фотографию"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={(event) => {
            event.stopPropagation()
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            void select(files)
          }}
        />
      </Group>
      <div className={classes.photos}>
        {ids.map((id, index) => (
          <div key={id}>
            <StoredPhoto
              id={id}
              blob={added.find((photo) => photo.id === id)?.blob}
              alt={`Фото ${index + 1}`}
            />
            <Group gap="xs">
              <Button
                variant="default"
                disabled={disabled || index === 0}
                onClick={() => move(index, 0)}
              >
                На обложку
              </Button>
              <Button
                variant="default"
                aria-label={`Фото ${index + 1} раньше`}
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
              >
                ←
              </Button>
              <Button
                variant="default"
                aria-label={`Фото ${index + 1} позже`}
                disabled={disabled || index === ids.length - 1}
                onClick={() => move(index, index + 1)}
              >
                →
              </Button>
              <Button
                variant="default"
                aria-label={`Удалить фото ${index + 1}`}
                disabled={disabled}
                onClick={() =>
                  onChange(
                    ids.filter((value) => value !== id),
                    added.filter((photo) => photo.id !== id),
                  )
                }
              >
                Удалить
              </Button>
            </Group>
          </div>
        ))}
      </div>
    </section>
  )
}
