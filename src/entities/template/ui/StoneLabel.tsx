import type { CSSProperties } from 'react'
import classes from './StoneLabel.module.scss'

export function StoneLabel({ label, color }: { label: string; color?: string }) {
  return (
    <span className={classes.label}>
      <svg
        className={classes.gem}
        viewBox="0 0 20 20"
        aria-hidden="true"
        style={color ? ({ '--stone-color': color } as CSSProperties) : undefined}
      >
        <path d="M5 2 L15 2 L19 10 L15 18 L5 18 L1 10 Z" />
      </svg>
      <span>{label}</span>
    </span>
  )
}
