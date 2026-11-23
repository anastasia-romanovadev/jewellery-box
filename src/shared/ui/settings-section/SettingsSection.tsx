import { useId, useState, type ReactNode } from 'react'
import classes from './SettingsSection.module.scss'

export function SettingsSection({
  title,
  description,
  className,
  children,
}: {
  title: string
  description?: string
  className: string
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)
  const id = useId()
  return (
    <section className={className} aria-labelledby={id + '-title'}>
      <h2 id={id + '-title'}>
        <button
          className={classes.toggle}
          type="button"
          aria-expanded={opened}
          aria-controls={id}
          aria-describedby={description ? id + '-description' : undefined}
          onClick={() => setOpened(!opened)}
        >
          <span>{title}</span>
          <svg className={classes.arrow} data-open={opened} aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>
      {description && (
        <p id={id + '-description'} className={classes.description}>
          {description}
        </p>
      )}
      <div id={id} hidden={!opened} className={classes.content}>
        {children}
      </div>
    </section>
  )
}
