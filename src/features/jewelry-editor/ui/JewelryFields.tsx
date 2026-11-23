import { Fragment, type ReactNode } from 'react'
import { MultiSelect, NativeSelect, Textarea, TextInput } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import type {
  CardSnapshot,
  CardValues,
  DictionaryEntry,
  DictionaryOption,
} from '../../../entities/template/model/template'
import classes from './JewelryEditor.module.scss'
import { selectedFineness } from '../../../entities/template/model/material-fineness'
import { StoneLabel } from '../../../entities/template/ui/StoneLabel'
import { FinenessFields } from './FinenessFields'
import { sortJewelryTypes } from '../../../entities/template/model/jewelry-types'

export function JewelryFields({
  snapshot,
  entries,
  previousValues,
  form,
  disabled,
  onType,
  onChanged,
  renderPhotos,
}: {
  snapshot: CardSnapshot
  entries: DictionaryEntry[]
  previousValues?: CardValues
  form: UseFormReturnType<CardValues>
  disabled: boolean
  onType: (id: string) => void
  onChanged: () => void
  renderPhotos: (label: string) => ReactNode
}) {
  function options(
    kind: DictionaryEntry['kind'],
    historical: DictionaryOption[],
    selected: string[],
  ) {
    const retained =
      kind === 'material'
        ? (previousValues?.materialIds ?? [])
        : kind === 'stone'
          ? (previousValues?.stoneIds ?? [])
          : selectedFineness(previousValues)
    const result = new Map(
      entries
        .filter((entry) => entry.kind === kind && entry.enabled)
        .map((entry) => [
          entry.id,
          { value: entry.id, label: entry.label, color: entry.color, metal: entry.metal },
        ]),
    )
    for (const id of selected) {
      // Only saved selections own historical labels, colors and metal metadata.
      if (!retained.includes(id)) continue
      const previous = historical.find((option) => option.id === id)
      if (previous)
        result.set(id, {
          value: id,
          label: previous.label,
          color: previous.color,
          metal: previous.metal,
        })
    }
    return [...result.values()]
  }
  const materialIds = form.values.materialIds ?? []
  const finenessOptions = options(
    'fineness',
    snapshot.fields.find((field) => field.id === 'fineness')?.options ?? [],
    selectedFineness(form.values),
  )
  return (
    <div className={classes.fields} onChange={onChanged}>
      {[...snapshot.fields]
        .sort((a, b) => a.order - b.order)
        .map((field) => {
          const label = field.unit ? `${field.label}, ${field.unit}` : field.label
          if (field.id === 'type')
            return (
              <NativeSelect
                key={field.id}
                label={field.label}
                required={field.required}
                value={snapshot.typeId}
                disabled={disabled}
                data={sortJewelryTypes(
                  entries.filter((entry) => entry.kind === 'type' && entry.enabled),
                ).map((entry) => ({ value: entry.id, label: entry.label }))}
                onChange={(event) => onType(event.currentTarget.value)}
              />
            )
          if (field.id === 'photos')
            return <Fragment key={field.id}>{renderPhotos(field.label)}</Fragment>
          if (field.source === 'custom')
            return (
              <TextInput
                key={field.id}
                label={field.label}
                disabled={disabled}
                value={form.values.customValues[field.id] ?? ''}
                error={form.errors['customValues.' + field.id]}
                onChange={(event) =>
                  form.setFieldValue('customValues', {
                    ...form.values.customValues,
                    [field.id]: event.currentTarget.value,
                  })
                }
              />
            )
          if (field.id === 'materials' || field.id === 'stones') {
            const key = field.id === 'materials' ? 'materialIds' : 'stoneIds'
            return (
              <MultiSelect
                key={field.id}
                label={field.label}
                required={field.required}
                disabled={disabled}
                data={options(
                  field.id === 'materials' ? 'material' : 'stone',
                  field.id === 'materials' ? snapshot.materials : snapshot.stones,
                  form.values[key] ?? [],
                )}
                value={form.values[key] ?? []}
                error={form.errors[key]}
                renderOption={
                  field.id === 'stones'
                    ? ({ option }) => (
                        <StoneLabel
                          label={option.label}
                          color={
                            options('stone', snapshot.stones, form.values.stoneIds ?? []).find(
                              (entry) => entry.value === option.value,
                            )?.color
                          }
                        />
                      )
                    : undefined
                }
                onChange={(value) => {
                  onChanged()
                  if (key === 'materialIds') {
                    form.setValues({
                      materialIds: value,
                      materialFineness: Object.fromEntries(
                        Object.entries(form.values.materialFineness ?? {}).filter(([id]) =>
                          value.includes(id),
                        ),
                      ),
                    })
                    for (const key of Object.keys(form.errors)) {
                      if (key.startsWith('materialFineness.')) form.clearFieldError(key)
                    }
                  } else form.setFieldValue(key, value)
                }}
              />
            )
          }
          if (field.id === 'fineness')
            return (
              <FinenessFields
                key={field.id}
                label={field.label}
                required={field.required}
                disabled={disabled}
                materials={materialIds.map((id) => ({
                  id,
                  label:
                    options('material', snapshot.materials, materialIds).find(
                      (option) => option.value === id,
                    )?.label ?? id,
                }))}
                options={finenessOptions.map(({ value, ...option }) => ({ ...option, id: value }))}
                values={form.values.materialFineness ?? {}}
                errors={form.errors}
                onChange={(materialId, value) => {
                  form.setFieldValue('materialFineness', {
                    ...form.values.materialFineness,
                    [materialId]: value,
                  })
                  form.clearFieldError(`materialFineness.${materialId}`)
                }}
              />
            )
          if (field.id === 'weight')
            return (
              <TextInput
                key={field.id}
                label={label}
                inputMode="decimal"
                required
                disabled={disabled}
                value={form.values.weightGrams ?? ''}
                error={form.errors.weightGrams}
                onChange={(event) => form.setFieldValue('weightGrams', event.currentTarget.value)}
              />
            )
          if (field.id === 'notes')
            return (
              <Textarea
                key={field.id}
                label={field.label}
                disabled={disabled}
                {...form.getInputProps('notes')}
              />
            )
          if (field.id === 'size')
            return snapshot.sizeKind === 'earring' ? (
              <NativeSelect
                key={field.id}
                label={label}
                disabled={disabled}
                value={form.values.size ?? ''}
                error={form.errors.size}
                data={[
                  { value: '', label: 'Не указан' },
                  ...(field.options ?? []).map((option) => ({
                    value: option.id,
                    label: option.label,
                  })),
                ]}
                onChange={(event) => form.setFieldValue('size', event.currentTarget.value)}
              />
            ) : (
              <TextInput
                key={field.id}
                label={label}
                inputMode="decimal"
                disabled={disabled}
                value={form.values.size ?? ''}
                error={form.errors.size}
                onChange={(event) => form.setFieldValue('size', event.currentTarget.value)}
              />
            )
          return null
        })}
    </div>
  )
}
