import { NativeSelect } from '@mantine/core'
import type { ReactNode } from 'react'
import type { DictionaryOption } from '../../../entities/template/model/types'
import { matchesMaterials } from '../../../entities/template/model/material-fineness'

export function FinenessFields({
  label,
  materials,
  options,
  values,
  errors,
  disabled,
  required,
  onChange,
}: {
  label: string
  materials: DictionaryOption[]
  options: DictionaryOption[]
  values: Record<string, string>
  errors: Record<string, ReactNode>
  disabled: boolean
  required: boolean
  onChange: (materialId: string, value: string) => void
}) {
  return materials.map((material) => {
    const available = options.filter(
      (option) =>
        matchesMaterials(option, [material.id]) ||
        (!option.metal && option.id === values[material.id]),
    )
    return (
      <NativeSelect
        key={material.id}
        label={`${label} — ${material.label}`}
        required={required}
        disabled={disabled || !available.length}
        description={
          !available.length
            ? 'Добавь пробу для этого материала в настройках справочника.'
            : undefined
        }
        data={[
          { value: '', label: available.length ? 'Выбери пробу' : 'Нет доступных проб' },
          ...available.map((option) => ({ value: option.id, label: option.label })),
        ]}
        value={values[material.id] ?? ''}
        error={errors[`materialFineness.${material.id}`]}
        onChange={(event) => onChange(material.id, event.currentTarget.value)}
      />
    )
  })
}
