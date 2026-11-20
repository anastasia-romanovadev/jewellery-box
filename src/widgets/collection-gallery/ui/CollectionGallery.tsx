import type { JewelryItem } from '../../../entities/jewelry/model/item'
import { JewelryCard } from '../../../entities/jewelry/ui/JewelryCard'
import classes from './CollectionGallery.module.scss'
export function CollectionGallery({
  items,
  onOpen,
}: {
  items: JewelryItem[]
  onOpen: (item: JewelryItem) => void
}) {
  return (
    <div className={classes.cards}>
      {items.map((item) => (
        <JewelryCard key={item.id} jewelry={item} onOpen={() => onOpen(item)} />
      ))}
    </div>
  )
}
