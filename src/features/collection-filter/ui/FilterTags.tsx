import type { ReactNode } from 'react'
import classes from './CollectionFilters.module.scss'

export function FilterTags({
  label,
  options,
  selected,
  onSelect,
  renderLabel,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onSelect: (value: string) => void
  renderLabel?: (option: { value: string; label: string }) => ReactNode
}) {
  return (
    <fieldset className={classes.tagsGroup}>
      <legend>{label}</legend>
      <div className={classes.tags}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={classes.tag}
            aria-pressed={selected.includes(option.value)}
            onClick={() => onSelect(option.value)}
          >
            {renderLabel ? renderLabel(option) : option.label}
          </button>
        ))}
      </div>
      {!options.length && <p className={classes.empty}>Пока нет вариантов</p>}
    </fieldset>
  )
}
