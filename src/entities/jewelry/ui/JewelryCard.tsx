import type { JewelryItem } from '../model/item'
import { StoredPhoto } from './StoredPhoto'
import classes from './JewelryCard.module.scss'

export function JewelryCard({ jewelry, onOpen }: { jewelry: JewelryItem; onOpen: () => void }) {
  const materials = jewelry.materialIds
    .map((id) => jewelry.snapshot.materials.find((option) => option.id === id)?.label)
    .filter(Boolean)
    .join(', ')
  return (
    <button
      type="button"
      className={classes.card}
      onClick={onOpen}
      aria-label={'Открыть: ' + jewelry.snapshot.typeLabel + (materials ? ', ' + materials : '')}
    >
      {jewelry.photoIds[0] ? (
        <StoredPhoto id={jewelry.photoIds[0]} alt={jewelry.snapshot.typeLabel} />
      ) : (
        <div className={classes.placeholder}>Без фотографии</div>
      )}
      <span className={classes.title}>{jewelry.snapshot.typeLabel}</span>
      {materials && <span>{materials}</span>}
      {jewelry.weightGrams !== undefined && (
        <span>{jewelry.weightGrams.toLocaleString('ru')} г</span>
      )}
    </button>
  )
}
