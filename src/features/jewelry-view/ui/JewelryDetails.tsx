import { useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Group, Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { JewelryItem } from '../../../entities/jewelry/model/item'
import { PhotoGallery } from './PhotoGallery'
import { deleteItem } from '../../../data/jewelry-repository'
import { storageErrorMessage } from '../../../data/catalog-repository'
import classes from './JewelryDetails.module.scss'
import { StoneLabel } from '../../../entities/template/ui/StoneLabel'
import { finenessLabel } from '../../../entities/template/model/dictionary-options'
import { PhotoSaveMenu } from './PhotoSaveMenu'

export function JewelryDetails({
  item,
  onClose,
  onEdit,
}: {
  item: JewelryItem
  onClose: () => void
  onEdit: () => void
}) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [viewer, setViewer] = useState(false)
  const [savingPhotos, setSavingPhotos] = useState(false)
  const saveTrigger = useRef<HTMLButtonElement>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mobile = useMediaQuery('(max-width: 640px)')
  const index = Math.min(photoIndex, Math.max(0, item.photoIds.length - 1))
  const photoId = item.photoIds[index]
  async function remove() {
    if (!window.confirm('Удалить украшение и все его фотографии? Это действие нельзя отменить.'))
      return
    setRemoving(true)
    try {
      await deleteItem(item.id, item.revision)
      onClose()
    } catch (reason) {
      setError(storageErrorMessage(reason))
      setRemoving(false)
    }
  }
  function fieldValue(id: string): ReactNode {
    if (id === 'type' || id === 'photos') return undefined
    if (id === 'materials')
      return item.materialIds
        .map((id) => item.snapshot.materials.find((option) => option.id === id)?.label)
        .filter(Boolean)
        .join(', ')
    if (id === 'stones')
      return item.stoneIds.length ? (
        <div className={classes.stones}>
          {item.stoneIds.map((id) => {
            const stone = item.snapshot.stones.find((option) => option.id === id)
            return stone ? <StoneLabel key={id} label={stone.label} color={stone.color} /> : null
          })}
        </div>
      ) : (
        ''
      )
    if (id === 'fineness') {
      if (item.materialFineness !== undefined) {
        if (!item.materialIds.length) return undefined
        const options = item.snapshot.fields.find((field) => field.id === id)?.options ?? []
        return item.materialIds.flatMap((materialId) => {
          const material = item.snapshot.materials.find((option) => option.id === materialId)
          const option = options.find((option) => option.id === item.materialFineness?.[materialId])
          if (!option) return []
          return (
            <div key={materialId}>
              {material?.label}: {option.label}
            </div>
          )
        })
      }
      const option = item.snapshot.fields
        .find((field) => field.id === id)
        ?.options?.find((option) => option.id === item.finenessId)
      return option ? finenessLabel(option) : ''
    }
    if (id === 'weight')
      return item.weightGrams === undefined ? '' : item.weightGrams.toLocaleString('ru') + ' г'
    if (id === 'size')
      return item.size === undefined
        ? ''
        : item.snapshot.sizeKind === 'earring'
          ? item.snapshot.fields
              .find((field) => field.id === 'size')
              ?.options?.find((option) => option.id === item.size)?.label
          : String(item.size).replace('.', ',') + (item.snapshot.sizeKind === 'length' ? ' см' : '')
    if (id === 'notes') return item.notes
    return item.customValues[id]
  }
  return (
    <Modal.Stack>
      <Modal
        stackId="jewelry-details"
        opened
        onClose={() => {
          if (!removing) onClose()
        }}
        title={item.snapshot.typeLabel}
        fullScreen={mobile}
        size="lg"
        closeButtonProps={{ 'aria-label': 'Закрыть карточку', disabled: removing }}
        closeOnEscape={!removing}
        closeOnClickOutside={!removing}
      >
        <div className={classes.details}>
          {error && (
            <Alert role="alert" color="red">
              {error}
            </Alert>
          )}
          {photoId ? (
            <PhotoGallery
              photoIds={item.photoIds}
              index={index}
              label={item.snapshot.typeLabel}
              onChange={setPhotoIndex}
              onOpen={() => setViewer(true)}
            />
          ) : null}
          {photoId && (
            <Button
              variant="default"
              disabled={removing}
              onClick={(event) => {
                saveTrigger.current = event.currentTarget
                setSavingPhotos(true)
              }}
              aria-haspopup="dialog"
            >
              Сохранить фото
            </Button>
          )}
          <dl>
            {item.snapshot.fields
              .filter((field) => field.enabled !== false)
              .map((field) => {
                const value = fieldValue(field.id)
                return value == null ||
                  (typeof value === 'string' && !value.trim()) ||
                  (Array.isArray(value) && !value.length) ? null : (
                  <div key={field.id}>
                    <dt>{field.label}</dt>
                    <dd>{value}</dd>
                  </div>
                )
              })}
          </dl>
          <Group>
            <Button disabled={removing} onClick={onEdit}>
              Редактировать
            </Button>
            <Button variant="default" loading={removing} onClick={() => void remove()}>
              Удалить украшение
            </Button>
          </Group>
        </div>
      </Modal>
      <Modal
        stackId="jewelry-photo-viewer"
        opened={viewer}
        fullScreen
        onClose={() => setViewer(false)}
        title="Просмотр фотографии"
        closeButtonProps={{ 'aria-label': 'Закрыть просмотр фото' }}
      >
        <div className={classes.viewer}>
          {photoId && (
            <PhotoGallery
              photoIds={item.photoIds}
              index={index}
              label={item.snapshot.typeLabel}
              onChange={setPhotoIndex}
            />
          )}
          {photoId && (
            <Button
              variant="default"
              onClick={(event) => {
                saveTrigger.current = event.currentTarget
                setSavingPhotos(true)
              }}
              aria-haspopup="dialog"
            >
              Сохранить фото
            </Button>
          )}
          <p>Для увеличения используй масштабирование браузера.</p>
        </div>
      </Modal>
      <PhotoSaveMenu
        opened={savingPhotos}
        onAfterClose={() => saveTrigger.current?.focus()}
        onClose={() => setSavingPhotos(false)}
        itemId={item.id}
        photoIds={item.photoIds}
        currentId={photoId ?? ''}
      />
    </Modal.Stack>
  )
}
