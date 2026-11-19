import { useCatalog } from '../../../data/useCatalog'
import { JEWELRY_CATEGORIES, type CategoryFilterId } from '../../../entities/jewelry/model/jewelry'
import classes from './CategoryFilter.module.scss'

type CategoryFilterProps = {
  selectedCategory: CategoryFilterId
  onSelect: (category: CategoryFilterId) => void
}

export function CategoryFilter({ selectedCategory, onSelect }: CategoryFilterProps) {
  const { catalog } = useCatalog()
  const categories = catalog
    ? [
        { id: 'all', label: 'Все' },
        ...catalog.entries
          .filter(
            (entry) => entry.kind === 'type' && (entry.enabled || entry.id === selectedCategory),
          )
          .map((entry) => ({
            id: entry.id,
            label: entry.label + (entry.enabled ? '' : ' (удалён)'),
          })),
      ]
    : JEWELRY_CATEGORIES
  return (
    <nav className={classes.filters} aria-label="Категории коллекции">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={`${classes.filter} ${selectedCategory === category.id ? classes.selected : ''}`}
          aria-pressed={selectedCategory === category.id}
          onClick={() => onSelect(category.id)}
        >
          {category.label}
        </button>
      ))}
    </nav>
  )
}
