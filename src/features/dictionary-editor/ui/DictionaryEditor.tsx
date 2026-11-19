import { SettingsSection } from '../../../shared/ui/settings-section/SettingsSection'
import { useLayoutEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, NativeSelect, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import type {
  DictionaryEntry,
  DictionaryKind,
  SizeKind,
} from '../../../entities/template/model/template'
import { normalizeDictionaryLabel } from '../../../entities/template/model/template'
import classes from './DictionaryEditor.module.scss'

type DictionaryEditorProps = {
  entries: DictionaryEntry[]
  onSave: (draft: DictionaryEntry) => Promise<DictionaryEntry>
  allowTypeSizeEditing?: boolean
  allowTypeCreation?: boolean
}

const KINDS: { value: DictionaryKind; label: string }[] = [
  { value: 'type', label: 'Типы изделий' },
  { value: 'material', label: 'Материалы' },
  { value: 'stone', label: 'Камни' },
]
const SIZE_KINDS: { value: SizeKind; label: string }[] = [
  { value: 'none', label: 'Без размера' },
  { value: 'ring', label: 'Число, как у кольца' },
  { value: 'length', label: 'Длина в сантиметрах' },
  { value: 'earring', label: 'Маленькие / средние / большие' },
]

function isKind(value: string): value is DictionaryKind {
  return KINDS.some((kind) => kind.value === value)
}

function isSizeKind(value: string): value is SizeKind {
  return SIZE_KINDS.some((kind) => kind.value === value)
}

export function DictionaryEditor({
  entries,
  onSave,
  allowTypeSizeEditing = false,
  allowTypeCreation = false,
}: DictionaryEditorProps) {
  const [kind, setKind] = useState<DictionaryKind>('material')
  const kindControl = useRef<HTMLSelectElement>(null)
  const creationInput = useRef<HTMLInputElement>(null)
  const editButtons = useRef(new Map<string, HTMLButtonElement>())
  const editFocus = useRef<string | null>(null)
  const removalTrigger = useRef<HTMLButtonElement | null>(null)
  const [editing, setEditing] = useState<DictionaryEntry | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<DictionaryEntry | null>(null)
  const [committed, setCommitted] = useState<DictionaryEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const editForm = useForm<{ label: string; sizeKind: SizeKind }>({
    initialValues: { label: '', sizeKind: 'none' },
    validate: { label: (value) => (value.trim() ? null : 'Введите название') },
  })
  const [removalError, setRemovalError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const form = useForm<{ label: string; sizeKind: SizeKind }>({
    initialValues: { label: '', sizeKind: 'none' },
    validate: { label: (value) => (value.trim() ? null : 'Введите название') },
  })
  const combined = new Map<string, DictionaryEntry>()
  for (const entry of [...entries, ...committed]) {
    const known = combined.get(entry.id)
    if (!known || entry.revision > known.revision) combined.set(entry.id, entry)
  }
  const currentEntries = [...combined.values()]
  const visibleEntries = currentEntries.filter(
    (entry) => entry.kind === kind && (entry.enabled || entry.id === editing?.id),
  )
  const hasDraft = editing !== null || form.isDirty()
  const changedElsewhere =
    editing !== null && combined.get(editing.id)?.revision !== editing.revision

  useLayoutEffect(() => {
    if (editing || saving || editFocus.current === null) return
    const button = editButtons.current.get(editFocus.current)
    if (button) button.focus()
    else focusDictionary()
    editFocus.current = null
  })

  function focusDictionary() {
    const control = kindControl.current
    if (control && !control.disabled) control.focus()
    else creationInput.current?.focus()
  }

  function recordCommit(entry: DictionaryEntry) {
    setCommitted((current) => [...current.filter(({ id }) => id !== entry.id), entry])
  }

  function clearEditor() {
    editFocus.current = editing?.id ?? null
    setEditing(null)
    editForm.reset()
    setEditError(null)
  }

  function startEditing(entry: DictionaryEntry) {
    setEditing(entry)
    const values = { label: entry.label, sizeKind: entry.sizeKind ?? 'none' }
    editForm.setValues(values)
    editForm.resetDirty(values)
    editForm.clearErrors()
    setEditError(null)
    setNotice(null)
  }

  async function save(
    values: { label: string; sizeKind: SizeKind },
    target: DictionaryEntry | null = null,
  ) {
    const activeForm = target ? editForm : form
    const reportError = target ? setEditError : setError
    if (kind === 'type' && !target && !allowTypeCreation) return
    const label = values.label.trim()
    const duplicate = currentEntries.some(
      (entry) =>
        entry.enabled &&
        entry.kind === kind &&
        entry.id !== target?.id &&
        normalizeDictionaryLabel(entry.label) === normalizeDictionaryLabel(label),
    )
    if (duplicate) {
      activeForm.setFieldError('label', 'Такое название уже есть в этом списке')
      return
    }
    const draft: DictionaryEntry = {
      id: target?.id ?? crypto.randomUUID(),
      kind,
      label,
      enabled: true,
      revision: target?.revision ?? 0,
      ...(kind === 'type' ? { sizeKind: values.sizeKind } : {}),
    }
    setSaving(true)
    reportError(null)
    setNotice(null)
    try {
      recordCommit(await onSave(draft))
      if (target) clearEditor()
      else form.reset()
      setNotice('Справочник сохранён.')
    } catch (failure) {
      reportError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось сохранить справочник. Попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!pendingRemoval) return
    setSaving(true)
    setRemovalError(null)
    try {
      recordCommit(await onSave({ ...pendingRemoval, enabled: false }))
      setPendingRemoval(null)
      setNotice('Вариант удалён из нового выбора. Старые карточки сохранены.')
    } catch (failure) {
      setRemovalError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось удалить вариант. Попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection className={classes.editor} title="Справочники">
      <p>
        Общие списки вариантов для карточек. Переименование и удаление не меняют старые украшения.
      </p>

      <NativeSelect
        ref={kindControl}
        label="Справочник"
        data={KINDS}
        value={kind}
        disabled={saving || hasDraft}
        onChange={(event) => {
          if (isKind(event.currentTarget.value)) setKind(event.currentTarget.value)
          setNotice(null)
        }}
      />
      {visibleEntries.length > 0 ? (
        <ul className={classes.entries}>
          {visibleEntries.map((entry) => (
            <li key={entry.id} className={classes.entry}>
              {editing?.id === entry.id ? (
                <form
                  className={classes.inlineForm}
                  onSubmit={(event) =>
                    editForm.onSubmit((values) => void save(values, editing))(event)
                  }
                >
                  <TextInput
                    aria-label={`Название варианта «${editing.label}»`}
                    autoFocus
                    disabled={saving}
                    {...editForm.getInputProps('label')}
                  />
                  <div className={classes.actions}>
                    <Button type="submit" loading={saving}>
                      Сохранить вариант
                    </Button>
                    <Button variant="default" disabled={saving} onClick={clearEditor}>
                      Отменить редактирование
                    </Button>
                  </div>
                  {changedElsewhere && (
                    <Alert
                      className={classes.error}
                      role="alert"
                      title="Вариант изменён в другой вкладке"
                    >
                      Ваш текст остаётся в редакторе. Отмените изменения, чтобы открыть актуальную
                      версию.
                    </Alert>
                  )}
                  {editError && (
                    <Alert className={classes.error} role="alert" title="Справочник не сохранён">
                      {editError}
                    </Alert>
                  )}
                </form>
              ) : (
                <>
                  <span className={classes.label}>{entry.label}</span>
                  <div className={classes.actions}>
                    <Button
                      variant="default"
                      ref={(button) => {
                        if (button) editButtons.current.set(entry.id, button)
                        else editButtons.current.delete(entry.id)
                      }}
                      disabled={saving || editing !== null}
                      aria-label={`Изменить «${entry.label}»`}
                      onClick={() => startEditing(entry)}
                    >
                      Изменить
                    </Button>
                    <Button
                      variant="default"
                      disabled={saving || editing !== null}
                      aria-label={`Удалить «${entry.label}»`}
                      onClick={(event) => {
                        removalTrigger.current = event.currentTarget
                        setPendingRemoval(entry)
                        setRemovalError(null)
                        setNotice(null)
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>Список пока пуст. Добавьте первый вариант ниже.</p>
      )}
      <form
        className={classes.form}
        onSubmit={(event) => form.onSubmit((values) => void save(values))(event)}
      >
        <h3>Добавить вариант</h3>
        {error && (
          <Alert className={classes.error} role="alert" title="Справочник не сохранён">
            {error}
          </Alert>
        )}
        {kind === 'type' && !allowTypeCreation && (
          <p>
            Добавление новых типов пока недоступно. Существующие типы можно переименовать или
            удалить.
          </p>
        )}
        <TextInput
          ref={creationInput}
          label="Название варианта"
          disabled={saving || (kind === 'type' && !allowTypeCreation)}
          {...form.getInputProps('label')}
        />
        {kind === 'type' && allowTypeSizeEditing && (
          <NativeSelect
            label="Формат размера"
            data={SIZE_KINDS}
            value={form.values.sizeKind}
            disabled={saving}
            onChange={(event) => {
              if (isSizeKind(event.currentTarget.value))
                form.setFieldValue('sizeKind', event.currentTarget.value)
            }}
          />
        )}
        <div className={classes.actions}>
          <Button type="submit" loading={saving} disabled={kind === 'type' && !allowTypeCreation}>
            Добавить вариант
          </Button>
          <Button
            variant="default"
            disabled={saving || !form.isDirty()}
            onClick={() => {
              form.reset()
              setError(null)
              setNotice(null)
            }}
          >
            Отменить
          </Button>
        </div>
      </form>
      {notice && <p role="status">{notice}</p>}
      <Modal
        returnFocus={false}
        onExitTransitionEnd={() => {
          const trigger = removalTrigger.current
          if (trigger?.isConnected && !trigger.disabled) trigger.focus()
          else focusDictionary()
          removalTrigger.current = null
        }}
        opened={pendingRemoval !== null}
        onClose={() => {
          if (!saving) setPendingRemoval(null)
        }}
        title="Удалить вариант из справочника?"
        closeButtonProps={{ 'aria-label': 'Закрыть подтверждение удаления', disabled: saving }}
        closeOnEscape={!saving}
        closeOnClickOutside={!saving}
      >
        <div className={classes.confirmation}>
          <p>
            «{pendingRemoval?.label}» больше не будет предлагаться для нового выбора. Старые
            карточки и их значения останутся без изменений.
          </p>
          {removalError && (
            <Alert className={classes.error} role="alert" title="Вариант не удалён">
              {removalError}
            </Alert>
          )}
          <div className={classes.actions}>
            <Button onClick={() => void remove()} loading={saving}>
              Подтвердить удаление
            </Button>
            <Button variant="default" disabled={saving} onClick={() => setPendingRemoval(null)}>
              Не удалять
            </Button>
          </div>
        </div>
      </Modal>
    </SettingsSection>
  )
}
