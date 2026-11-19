import { JEWELRY_CATEGORIES } from '../../../entities/jewelry/model/jewelry'
import classes from './CategoryFilter.module.scss'

type CategoryFilterProps = {
  selectedCategory: string
  onSelect: (category: string) => void
}

export function CategoryFilter({ selectedCategory, onSelect }: CategoryFilterProps) {
  return (
    <nav className={classes.filters} aria-label="Категории коллекции">
      {JEWELRY_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={`${classes.filter} ${selectedCategory === category ? classes.selected : ''}`}
          aria-pressed={selectedCategory === category}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </nav>
  )
}
