import classes from './ChoiceGroup.module.scss'

type Choice = {
  label: string
  value: string
}

type ChoiceGroupProps<T extends string> = {
  label: string
  name: string
  value: T
  options: readonly Choice[]
  onChange: (value: string) => void
}

export function ChoiceGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className={classes.group}>
      <legend className={classes.visuallyHidden}>{label}</legend>
      <div className={classes.options}>
        {options.map((option) => {
          const selected = value === option.value
          const id = `${name}-${option.value}`

          return (
            <label
              key={option.value}
              className={`${classes.option} ${selected ? classes.selected : ''}`}
              htmlFor={id}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
