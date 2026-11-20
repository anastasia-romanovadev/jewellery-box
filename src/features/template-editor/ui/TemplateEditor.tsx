import { SettingsSection } from '../../../shared/ui/settings-section/SettingsSection'
import { useState } from 'react'
import { ActionIcon, Alert, Button, Checkbox, NativeSelect, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  type CreationTemplate,
  type DictionaryEntry,
  type TemplateField,
} from '../../../entities/template/model/template'
import classes from './TemplateEditor.module.scss'

type TemplateEditorProps = {
  template: CreationTemplate
  entries: DictionaryEntry[]
  onSave: (draft: CreationTemplate) => Promise<CreationTemplate>
}

type ScopeControlProps = {
  label: string
  scope: TemplateField['scope']
  entries: DictionaryEntry[]
  disabled: boolean
  onChange: (scope: TemplateField['scope']) => void
}

function ScopeControl({ label, scope, entries, disabled, onChange }: ScopeControlProps) {
  const types = entries.filter(
    (entry) =>
      entry.kind === 'type' && (entry.enabled || (scope !== 'all' && scope.includes(entry.id))),
  )

  return (
    <div className={classes.scope}>
      <NativeSelect
        label={label}
        value={scope === 'all' ? 'all' : 'selected'}
        disabled={disabled}
        data={[
          { value: 'all', label: 'Все типы изделий' },
          { value: 'selected', label: 'Выбранные типы' },
        ]}
        onChange={(event) => onChange(event.currentTarget.value === 'all' ? 'all' : [])}
      />
      {scope !== 'all' && (
        <Checkbox.Group
          label="Типы изделий"
          value={scope}
          onChange={onChange}
          error={scope.length === 0 ? 'Выберите хотя бы один тип изделия' : undefined}
        >
          <div className={classes.options}>
            {types.map((entry) => (
              <Checkbox
                key={entry.id}
                value={entry.id}
                label={`${entry.label}${entry.enabled ? '' : ' (удалён из справочника)'}`}
                disabled={disabled}
                color="var(--accent)"
              />
            ))}
          </div>
        </Checkbox.Group>
      )}
    </div>
  )
}

export function TemplateEditor({ template, entries, onSave }: TemplateEditorProps) {
  const [draft, setDraft] = useState<CreationTemplate | null>(null)
  const [saved, setSaved] = useState<CreationTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newScope, setNewScope] = useState<TemplateField['scope']>('all')
  const form = useForm({
    initialValues: { label: '' },
    validate: { label: (value) => (value.trim() ? null : 'Введите название поля') },
  })
  // Live updates replace only a clean view. A dirty draft retains its original revision.
  const canonical = saved && saved.revision > template.revision ? saved : template
  const current = draft ?? canonical
  const fields = [...current.fields].sort((first, second) => first.order - second.order)
  const changedElsewhere = draft !== null && canonical.revision !== draft.revision

  function changeFields(nextFields: TemplateField[]) {
    setDraft({ ...current, fields: nextFields.map((field, order) => ({ ...field, order })) })
    setError(null)
    setNotice(null)
  }

  function updateField(id: string, update: Partial<TemplateField>) {
    changeFields(fields.map((field) => (field.id === id ? { ...field, ...update } : field)))
  }

  function addField(values: { label: string }) {
    if (newScope !== 'all' && newScope.length === 0) return
    changeFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        source: 'custom',
        label: values.label.trim(),
        kind: 'text',
        required: false,
        enabled: true,
        protected: false,
        scope: newScope === 'all' ? 'all' : [...newScope],
        order: fields.length,
      },
    ])
    form.reset()
    setNewScope('all')
  }

  async function save() {
    if (!draft) return
    if (
      fields.some(
        (field) => !field.label.trim() || (field.scope !== 'all' && field.scope.length === 0),
      )
    ) {
      setError('Проверьте названия полей и выбранные типы изделий.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await onSave({
        ...draft,
        fields: fields.map((field) => ({ ...field, label: field.label.trim() })),
      })
      setSaved(result)
      setDraft(null)
      setNotice('Шаблон сохранён. Изменения применятся к новым карточкам.')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Не удалось сохранить шаблон. Попробуйте ещё раз.',
      )
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setDraft(null)
    setSaved(null)
    setError(null)
    setNotice(null)
    form.reset()
    setNewScope('all')
  }

  return (
    <SettingsSection className={classes.editor} title="Шаблон новой карточки">
      <p>Добавьте свои текстовые поля. Существующие украшения сохранят прежний набор полей.</p>

      {changedElsewhere && (
        <Alert className={classes.message} role="alert" title="Шаблон изменён в другой вкладке">
          Ваши изменения сохранены в редакторе. Чтобы загрузить новую версию, отмените свои
          изменения.
        </Alert>
      )}
      {error && (
        <Alert className={classes.error} role="alert" title="Шаблон не сохранён">
          {error}
        </Alert>
      )}
      {notice && <p role="status">{notice}</p>}
      <p className={classes.hint}>Отметьте поля, которые будут видны в новой карточке.</p>
      <ul className={classes.fields}>
        {fields.map((field) => (
          <li key={field.id} className={classes.field}>
            <div className={classes.fieldRow}>
              {field.source === 'custom' ? (
                <TextInput
                  aria-label={`Название поля «${field.label || 'без названия'}»`}
                  value={field.label}
                  disabled={saving}
                  error={!field.label.trim() ? 'Введите название поля' : undefined}
                  onChange={(event) => updateField(field.id, { label: event.currentTarget.value })}
                />
              ) : (
                <label htmlFor={`field-visibility-${field.id}`}>{field.label}</label>
              )}
              <div className={classes.fieldControls}>
                {field.source === 'custom' && (
                  <ActionIcon
                    variant="subtle"
                    color="var(--fg-soft)"
                    size={44}
                    disabled={saving}
                    aria-label={`Удалить поле «${field.label}»`}
                    title="Удалить поле"
                    onClick={() => changeFields(fields.filter(({ id }) => id !== field.id))}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                    </svg>
                  </ActionIcon>
                )}
                <Checkbox
                  id={`field-visibility-${field.id}`}
                  aria-label={`Показывать поле «${field.label}»`}
                  checked={field.id === 'type' || field.enabled !== false}
                  disabled={saving || field.id === 'type'}
                  color="var(--accent)"
                  onChange={(event) =>
                    updateField(field.id, { enabled: event.currentTarget.checked })
                  }
                />
              </div>
            </div>
            {field.source === 'custom' && (
              <details className={classes.fieldOptions}>
                <summary>Настройки поля</summary>
                <ScopeControl
                  label={`Где показывать поле «${field.label || 'без названия'}»`}
                  scope={field.scope}
                  entries={entries}
                  disabled={saving}
                  onChange={(scope) => updateField(field.id, { scope })}
                />
              </details>
            )}
          </li>
        ))}
      </ul>
      <form className={classes.addForm} onSubmit={form.onSubmit(addField)}>
        <h3>Добавить поле</h3>
        <TextInput
          label="Название нового поля"
          placeholder="Например, тип застёжки"
          disabled={saving}
          {...form.getInputProps('label')}
        />
        <ScopeControl
          label="Где показывать новое поле"
          scope={newScope}
          entries={entries}
          disabled={saving}
          onChange={setNewScope}
        />
        <Button type="submit" disabled={saving}>
          Добавить поле в шаблон
        </Button>
      </form>
      <div className={classes.actions}>
        <Button onClick={() => void save()} loading={saving} disabled={!draft}>
          Сохранить шаблон
        </Button>
        <Button
          variant="default"
          disabled={saving || (!draft && !form.isDirty() && newScope === 'all')}
          onClick={cancel}
        >
          Отменить изменения
        </Button>
      </div>
      {draft && <p className={classes.hint}>Есть несохранённые изменения.</p>}
    </SettingsSection>
  )
}
