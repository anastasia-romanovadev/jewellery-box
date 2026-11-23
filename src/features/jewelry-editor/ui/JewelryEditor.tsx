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
import { database } from '../../../data/database'
import { ConflictError, storageErrorMessage, type Catalog } from '../../../data/catalog-repository'
import { BEFORE_NAVIGATE, type NavigationRequest } from '../../../shared/lib/navigation-guard'
import { DiscardJewelryDialog } from './DiscardJewelryDialog'
import { JewelryFields } from './JewelryFields'
import { PhotoEditor } from './PhotoEditor'
import { editableFineness } from '../../../entities/template/model/material-fineness'
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
      ? {
          ...itemValues(item),
          fineness: undefined,
          materialFineness: editableFineness(item.snapshot, itemValues(item)),
        }
      : {
          typeId: snapshot.typeId,
          materialIds: [],
          stoneIds: [],
          materialFineness: {},
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
  const [pendingExit, setPendingExit] = useState<NavigationRequest | null>(null)
  const busy = saving || preparing
  useEffect(() => {
    const guard = (event: Event) => {
      if (busy || changed) {
        event.preventDefault()
        if (!busy)
          setPendingExit(
            (pending) => pending ?? (event as CustomEvent<NavigationRequest>).detail ?? {},
          )
      }
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
    if (busy) return
    if (changed) setPendingExit({})
    else onClose()
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
        setError('Проверь обязательные поля и формат значений.')
        return
      }
      setSaving(true)
      const saved = await saveItem(
        { id, revision: item?.revision ?? 0, snapshot: reconciled, values: form.values },
        photos,
        database,
        initialCatalog.generation ?? 0,
      )
      onSaved(saved)
    } catch (reason) {
      setError(
        reason instanceof ConflictError
          ? 'Карточка изменена или удалена в другой вкладке. Твои правки остались в форме. Закрой её без сохранения и открой актуальную запись.'
          : storageErrorMessage(reason),
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal.Stack>
      <Modal
        stackId="jewelry-editor"
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
          {item?.finenessId &&
            item.materialFineness === undefined &&
            !Object.keys(editableFineness(item.snapshot, itemValues(item))).length && (
              <Alert title="Уточни пробы материалов">
                Ранее указана общая проба:{' '}
                {
                  item.snapshot.fields
                    .find((field) => field.id === 'fineness')
                    ?.options?.find((option) => option.id === item.finenessId)?.label
                }
                . Выбери пробу отдельно для каждого материала перед сохранением.
              </Alert>
            )}
          <JewelryFields
            snapshot={snapshot}
            entries={catalog.entries}
            previousValues={item ? itemValues(item) : undefined}
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
          {preparing && <p role="status">Проверяю фотографии…</p>}
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
      <DiscardJewelryDialog
        opened={pendingExit !== null}
        onStay={() => setPendingExit(null)}
        onDiscard={() => {
          if (busy) return
          onClose()
          pendingExit?.onConfirmed?.()
        }}
      />
    </Modal.Stack>
  )
}
