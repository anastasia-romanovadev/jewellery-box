import { useState } from 'react'
import { Alert, Button, Group, Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { JewelryItem } from '../../../entities/jewelry/model/item'
import { PhotoGallery } from './PhotoGallery'
import { deleteItem } from '../../../data/jewelry-repository'
import { storageErrorMessage } from '../../../data/catalog-repository'
import classes from './JewelryDetails.module.scss'

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
  function fieldValue(id: string): string | undefined {
    if (id === 'type' || id === 'photos') return undefined
    if (id === 'materials')
      return item.materialIds
        .map((id) => item.snapshot.materials.find((option) => option.id === id)?.label)
        .filter(Boolean)
        .join(', ')
    if (id === 'stones')
      return item.stoneIds
        .map((id) => item.snapshot.stones.find((option) => option.id === id)?.label)
        .filter(Boolean)
        .join(', ')
    if (id === 'fineness')
      return item.snapshot.fields
        .find((field) => field.id === id)
        ?.options?.find((option) => option.id === item.finenessId)?.label
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
    <>
      <Modal
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
          ) : (
            <p>Без фотографии</p>
          )}
          <dl>
            {item.snapshot.fields.map((field) => {
              const value = fieldValue(field.id)
              return value === undefined ? null : (
                <div key={field.id}>
                  <dt>{field.label}</dt>
                  <dd>{value || 'Не указано'}</dd>
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
      {viewer && (
        <Modal
          opened
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
            <p>Для увеличения используйте масштабирование браузера.</p>
          </div>
        </Modal>
      )}
    </>
  )
}
