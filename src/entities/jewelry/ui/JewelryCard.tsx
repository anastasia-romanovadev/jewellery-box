import type { Jewelry } from '../model/jewelry'
import classes from './JewelryCard.module.scss'

type JewelryCardProps = {
  jewelry: Jewelry
}

export function JewelryCard({ jewelry }: JewelryCardProps) {
  return (
    <article className={classes.card}>
      <div className={classes.visual} aria-hidden="true" />
      <div className={classes.heading}>
        <h2 className={classes.title}>{jewelry.name}</h2>
        <span className={classes.category}>{jewelry.category}</span>
      </div>
      <p className={classes.material}>{jewelry.material}</p>
      <div className={classes.footer}>
        <span className={classes.label}>В коллекции</span>
      </div>
    </article>
  )
}
