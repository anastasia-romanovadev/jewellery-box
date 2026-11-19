import { DEMO_JEWELRY } from '../../../entities/jewelry/model/jewelry'
import { JewelryCard } from '../../../entities/jewelry/ui/JewelryCard'
import classes from './CollectionGallery.module.scss'

export function CollectionGallery({ selectedCategory }: { selectedCategory: string }) {
  const visibleJewelry =
    selectedCategory === 'Все'
      ? DEMO_JEWELRY
      : DEMO_JEWELRY.filter((jewelry) => jewelry.category === selectedCategory)

  return (
    <div className={classes.gallery}>
      <div className={classes.cards}>
        {visibleJewelry.map((jewelry) => (
          <JewelryCard key={jewelry.id} jewelry={jewelry} />
        ))}
      </div>
    </div>
  )
}
