import { DEMO_JEWELRY, type CategoryFilterId } from '../../../entities/jewelry/model/jewelry'
import { JewelryCard } from '../../../entities/jewelry/ui/JewelryCard'
import classes from './CollectionGallery.module.scss'

export function CollectionGallery({ selectedCategory }: { selectedCategory: CategoryFilterId }) {
  const visibleJewelry =
    selectedCategory === 'all'
      ? DEMO_JEWELRY
      : DEMO_JEWELRY.filter((jewelry) => jewelry.typeId === selectedCategory)

  return (
    <div className={classes.gallery}>
      {visibleJewelry.length === 0 && <p role="status">В этой категории пока нет украшений.</p>}
      <div className={classes.cards}>
        {visibleJewelry.map((jewelry) => (
          <JewelryCard key={jewelry.id} jewelry={jewelry} />
        ))}
      </div>
    </div>
  )
}
