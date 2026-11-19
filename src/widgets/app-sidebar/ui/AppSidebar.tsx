import { FocusTrap } from '@mantine/core'
import { useFocusReturn } from '@mantine/hooks'
import { CategoryFilter } from '../../../features/collection-category/ui/CategoryFilter'
import classes from './AppSidebar.module.scss'

export type AppSection = 'collection' | 'settings'

type AppSidebarProps = {
  activeSection: AppSection
  isOpen: boolean
  selectedCategory: string
  onSelectCategory: (category: string) => void
  onNavigate: (section: AppSection) => void
  onClose: () => void
}

export function AppSidebar({
  activeSection,
  isOpen,
  onNavigate,
  onClose,
  selectedCategory,
  onSelectCategory,
}: AppSidebarProps) {
  useFocusReturn({ opened: isOpen })
  return (
    <>
      <FocusTrap active={isOpen}>
        <aside
          role={isOpen ? 'dialog' : undefined}
          aria-modal={isOpen || undefined}
          aria-label="Меню"
          id="main-sidebar"
          className={`${classes.sidebar} ${isOpen ? classes.open : ''}`}
        >
          {isOpen && (
            <button data-autofocus type="button" className={classes.navButton} onClick={onClose}>
              Закрыть меню
            </button>
          )}
          <div className={classes.brand}>
            <span className={classes.brandMark} aria-hidden="true" />
            Шкатулка
          </div>
          <nav className={classes.nav} aria-label="Основная навигация">
            <button
              type="button"
              className={`${classes.navButton} ${activeSection === 'collection' ? classes.active : ''}`}
              aria-current={activeSection === 'collection' ? 'page' : undefined}
              onClick={() => onNavigate('collection')}
            >
              Коллекция
            </button>
            <button
              type="button"
              className={`${classes.navButton} ${activeSection === 'settings' ? classes.active : ''}`}
              aria-current={activeSection === 'settings' ? 'page' : undefined}
              onClick={() => onNavigate('settings')}
            >
              Настройки
            </button>
          </nav>
          <CategoryFilter selectedCategory={selectedCategory} onSelect={onSelectCategory} />
          <p className={classes.note}>
            Личная коллекция украшений — аккуратно собрана и всегда под рукой.
          </p>
        </aside>
      </FocusTrap>
      {isOpen ? (
        <button
          type="button"
          className={classes.backdrop}
          aria-hidden="true"
          tabIndex={-1}
          onClick={onClose}
        />
      ) : null}
    </>
  )
}
