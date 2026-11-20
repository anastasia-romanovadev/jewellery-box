import { useEffect, useState } from 'react'
import { Alert, Button, Group, Modal } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  buildCardSnapshot,
  validateCardValues,
  type CardValues,
} from '../../../entities/template/model/template'
import {
  changeItemType,
  itemValues,
  type JewelryItem,
  type NewPhoto,
} from '../../../entities/jewelry/model/item'
import { reconcileSelections } from '../../../entities/jewelry/model/selected-options'
import { saveItem } from '../../../data/jewelry-repository'
import { ConflictError, storageErrorMessage, type Catalog } from '../../../data/catalog-repository'
import { BEFORE_NAVIGATE } from '../../../shared/lib/navigation-guard'
import { JewelryFields } from './JewelryFields'
import { PhotoEditor } from './PhotoEditor'
import classes from './JewelryEditor.module.scss'

export function JewelryEditor({
  item,
  catalog,
  category,
  onClose,
  onSaved,
}: {
  item?: JewelryItem
  catalog: Catalog
  category: string
  onClose: () => void
  onSaved: (item: JewelryItem) => void
}) {
  const mobile = useMediaQuery('(max-width: 640px)')
  const [initialCatalog] = useState(() => structuredClone(catalog))
  const [id] = useState(() => item?.id ?? crypto.randomUUID())
  const [snapshot, setSnapshot] = useState(
    () =>
      item?.snapshot ??
      buildCardSnapshot(
        initialCatalog.template,
        initialCatalog.entries,
        initialCatalog.entries.some(
          (entry) => entry.id === category && entry.kind === 'type' && entry.enabled,
        )
          ? category
          : 'ring',
      ),
  )
  const form = useForm<CardValues>({
    initialValues: item
      ? itemValues(item)
      : {
          typeId: snapshot.typeId,
          materialIds: [],
          stoneIds: [],
          fineness: '',
          weightGrams: '',
          notes: '',
          photoIds: [],
          customValues: {},
        },
  })
  const [photos, setPhotos] = useState<NewPhoto[]>([])
  const [changed, setChanged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = saving || preparing
  useEffect(() => {
    const guard = (event: Event) => {
      if (busy || (changed && !window.confirm('Выйти без сохранения? Изменения будут потеряны.')))
        event.preventDefault()
    }
    const unload = (event: BeforeUnloadEvent) => {
      if (changed || busy) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener(BEFORE_NAVIGATE, guard)
    window.addEventListener('beforeunload', unload)
    return () => {
      window.removeEventListener(BEFORE_NAVIGATE, guard)
      window.removeEventListener('beforeunload', unload)
    }
  }, [changed, busy])
  function close() {
    if (!busy && (!changed || window.confirm('Выйти без сохранения? Изменения будут потеряны.')))
      onClose()
  }
  function changeType(typeId: string) {
    const type = catalog.entries.find((entry) => entry.id === typeId && entry.kind === 'type')
    if (!type) return
    const next = changeItemType(snapshot, form.values, type)
    if (!item) {
      const rebuilt = buildCardSnapshot(initialCatalog.template, initialCatalog.entries, typeId)
      const allowed = new Set(
        rebuilt.fields.filter((field) => field.source === 'custom').map((field) => field.id),
      )
      next.snapshot = rebuilt
      next.values.customValues = Object.fromEntries(
        Object.entries(next.values.customValues).filter(([key]) => allowed.has(key)),
      )
    }
    setSnapshot(next.snapshot)
    form.setValues(next.values)
    form.clearErrors()
    setChanged(true)
  }
  async function save() {
    if (busy) return
    setError(null)
    try {
      const reconciled = reconcileSelections(
        snapshot,
        form.values,
        catalog.entries,
        item ? itemValues(item) : undefined,
      )
      const errors = validateCardValues(reconciled, form.values)
      form.setErrors(errors)
      if (Object.keys(errors).length) {
        setError('Проверьте обязательные поля и формат значений.')
        return
      }
      setSaving(true)
      const saved = await saveItem(
        { id, revision: item?.revision ?? 0, snapshot: reconciled, values: form.values },
        photos,
      )
      onSaved(saved)
    } catch (reason) {
      setError(
        reason instanceof ConflictError
          ? 'Карточка изменена или удалена в другой вкладке. Ваши правки остались в форме. Закройте её без сохранения и откройте актуальную запись.'
          : storageErrorMessage(reason),
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      opened
      onClose={close}
      fullScreen={mobile}
      size="lg"
      title={item ? 'Редактировать украшение' : 'Добавить украшение'}
      closeButtonProps={{ 'aria-label': 'Закрыть форму', disabled: busy }}
      closeOnClickOutside={false}
      closeOnEscape={!busy}
    >
      <form
        className={classes.form}
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        {error && (
          <Alert role="alert" color="red">
            {error}
          </Alert>
        )}
        <JewelryFields
          snapshot={snapshot}
          entries={catalog.entries}
          form={form}
          disabled={busy}
          onType={changeType}
          onChanged={() => setChanged(true)}
          renderPhotos={(label) => (
            <PhotoEditor
              label={label}
              ids={form.values.photoIds ?? []}
              added={photos}
              disabled={busy}
              error={typeof form.errors.photoIds === 'string' ? form.errors.photoIds : undefined}
              onBusy={setPreparing}
              onChange={(ids, added) => {
                form.setFieldValue('photoIds', ids)
                setPhotos(added)
                setChanged(true)
              }}
            />
          )}
        />
        {preparing && <p role="status">Проверяем фотографии…</p>}
        <Group>
          <Button type="submit" loading={saving} disabled={preparing}>
            Сохранить украшение
          </Button>
          <Button variant="default" disabled={busy} onClick={close}>
            Отмена
          </Button>
        </Group>
      </form>
    </Modal>
  )
}
