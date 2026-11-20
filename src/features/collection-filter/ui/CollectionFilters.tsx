import { useState } from 'react'
import { ActionIcon, Button, Modal, MultiSelect, NativeSelect, TextInput } from '@mantine/core'
import {
  EMPTY_FILTERS,
  type CollectionFilters as Filters,
  type JewelryItem,
} from '../../../entities/jewelry/model/item'
import type { DictionaryEntry } from '../../../entities/template/model/template'
import classes from './CollectionFilters.module.scss'

export function CollectionFilters({
  value,
  entries,
  items,
  onChange,
}: {
  value: Filters
  entries: DictionaryEntry[]
  items: JewelryItem[]
  onChange: (filters: Filters) => void
}) {
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState<Filters>(value)
  function choices(kind: 'material' | 'stone') {
    const options = new Map(
      entries
        .filter((entry) => entry.kind === kind && entry.enabled)
        .map((entry) => [entry.id, { value: entry.id, label: entry.label }]),
    )
    for (const item of items) {
      for (const id of kind === 'material' ? item.materialIds : item.stoneIds) {
        const label = (kind === 'material' ? item.snapshot.materials : item.snapshot.stones).find(
          (option) => option.id === id,
        )?.label
        if (!options.has(id) && label)
          options.set(id, { value: id, label: label + ' (из прежних записей)' })
      }
    }
    return [...options.values()]
  }
  const update = (patch: Partial<Filters>) => setDraft({ ...draft, ...patch })
  function rangeError(min: string, max: string) {
    const a = Number(min.replace(',', '.')),
      b = Number(max.replace(',', '.'))
    return (min && (!Number.isFinite(a) || a < 0)) ||
      (max && (!Number.isFinite(b) || b < 0)) ||
      (min && max && a > b)
      ? 'Проверьте диапазон'
      : undefined
  }
  const weightError = rangeError(draft.weightMin, draft.weightMax)
  const sizeError =
    draft.sizeKind === 'ring' || draft.sizeKind === 'length'
      ? rangeError(draft.sizeMin, draft.sizeMax)
      : undefined
  const materials = choices('material')
  const stones = choices('stone')
  function rangeLabel(min: string, max: string) {
    return [min && 'от ' + min, max && 'до ' + max].filter(Boolean).join(' ')
  }
  const summary = [
    ...value.materials.map((id) => materials.find((entry) => entry.value === id)?.label ?? id),
    ...value.stones.map((id) => stones.find((entry) => entry.value === id)?.label ?? id),
    value.sizeKind &&
      (value.sizeKind === 'earring'
        ? 'Серьги: ' +
          (new Map([
            ['small', 'маленькие'],
            ['medium', 'средние'],
            ['large', 'большие'],
          ]).get(value.earringSize) ?? 'любой размер')
        : (value.sizeKind === 'ring' ? 'Размер кольца' : 'Длина, см') +
          ' ' +
          rangeLabel(value.sizeMin, value.sizeMax)),
    (value.weightMin || value.weightMax) &&
      'Вес ' + rangeLabel(value.weightMin, value.weightMax) + ' г',
  ].filter(Boolean)
  return (
    <div className={classes.panel}>
      <Button
        variant="default"
        onClick={() => {
          setDraft(structuredClone(value))
          setOpened(true)
        }}
      >
        Фильтры
      </Button>
      {summary.length > 0 && (
        <div className={classes.applied} aria-label="Применённые фильтры">
          <span>{summary.join(' · ')}</span>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="Сбросить фильтры"
            onClick={() => onChange(structuredClone(EMPTY_FILTERS))}
          >
            ×
          </ActionIcon>
        </div>
      )}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Фильтры"
        closeButtonProps={{ 'aria-label': 'Закрыть фильтры' }}
        centered
      >
        <form
          className={classes.fields}
          onSubmit={(event) => {
            event.preventDefault()
            if (weightError || sizeError) return
            onChange(structuredClone(draft))
            setOpened(false)
          }}
        >
          <MultiSelect
            label="Металл"
            data={materials}
            value={draft.materials}
            onChange={(materials) => update({ materials })}
          />
          <MultiSelect
            label="Камни"
            data={stones}
            value={draft.stones}
            onChange={(stones) => update({ stones })}
          />
          <NativeSelect
            label="Формат размера"
            data={[
              { value: '', label: 'Любой' },
              { value: 'ring', label: 'Размер кольца' },
              { value: 'length', label: 'Длина, см' },
              { value: 'earring', label: 'Размер серёг' },
            ]}
            value={draft.sizeKind}
            onChange={(event) =>
              update({
                sizeKind: event.currentTarget.value,
                sizeMin: '',
                sizeMax: '',
                earringSize: '',
              })
            }
          />
          {draft.sizeKind === 'earring' ? (
            <NativeSelect
              label="Размер серёг"
              value={draft.earringSize}
              onChange={(event) => update({ earringSize: event.currentTarget.value })}
              data={[
                { value: '', label: 'Любой указанный' },
                { value: 'small', label: 'Маленькие' },
                { value: 'medium', label: 'Средние' },
                { value: 'large', label: 'Большие' },
              ]}
            />
          ) : (
            draft.sizeKind && (
              <>
                <TextInput
                  label="Размер от"
                  inputMode="decimal"
                  value={draft.sizeMin}
                  error={rangeError(draft.sizeMin, draft.sizeMax)}
                  onChange={(event) => update({ sizeMin: event.currentTarget.value })}
                />
                <TextInput
                  label="Размер до"
                  inputMode="decimal"
                  value={draft.sizeMax}
                  onChange={(event) => update({ sizeMax: event.currentTarget.value })}
                />
              </>
            )
          )}
          <fieldset className={classes.range}>
            <legend>Вес, г</legend>
            <div className={classes.rangeInputs}>
              <label htmlFor="filter-weight-min">от</label>
              <TextInput
                id="filter-weight-min"
                aria-label="Вес от, г"
                inputMode="decimal"
                value={draft.weightMin}
                aria-invalid={Boolean(weightError)}
                onChange={(event) => update({ weightMin: event.currentTarget.value })}
              />
              <label htmlFor="filter-weight-max">до</label>
              <TextInput
                id="filter-weight-max"
                aria-label="Вес до, г"
                inputMode="decimal"
                value={draft.weightMax}
                aria-invalid={Boolean(weightError)}
                onChange={(event) => update({ weightMax: event.currentTarget.value })}
              />
            </div>
            {weightError && (
              <p className={classes.error} role="alert">
                {weightError}
              </p>
            )}
          </fieldset>
          <Button type="submit" disabled={Boolean(weightError || sizeError)}>
            Применить фильтры
          </Button>
        </form>
      </Modal>
    </div>
  )
}
