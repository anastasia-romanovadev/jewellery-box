import { useState } from 'react'
import type { CategoryFilterId } from '../../../entities/jewelry/model/jewelry'
import { FocusTrap } from '@mantine/core'
import { useFocusReturn } from '@mantine/hooks'
import { CategoryFilter } from '../../../features/collection-category/ui/CategoryFilter'
import classes from './AppSidebar.module.scss'

export type AppSection = 'collection' | 'analytics' | 'settings'

type AppSidebarProps = {
  activeSection: AppSection
  isOpen: boolean
  selectedCategory: CategoryFilterId
  onSelectCategory: (category: CategoryFilterId) => void
  onNavigate: (section: AppSection) => void
  onClose: () => void
  fact: string
}

export function AppSidebar({
  activeSection,
  isOpen,
  onNavigate,
  onClose,
  selectedCategory,
  onSelectCategory,
  fact,
}: AppSidebarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const showCategories = categoriesOpen && activeSection === 'collection'
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
              aria-expanded={showCategories}
              aria-controls="collection-categories"
              onClick={() => {
                setCategoriesOpen(!showCategories)
                onNavigate('collection')
              }}
            >
              <span>Коллекция</span>
              <svg
                className={classes.chevron}
                data-open={showCategories}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div id="collection-categories" className={classes.categories} hidden={!showCategories}>
              <CategoryFilter selectedCategory={selectedCategory} onSelect={onSelectCategory} />
            </div>
            <button
              type="button"
              className={`${classes.navButton} ${activeSection === 'analytics' ? classes.active : ''}`}
              aria-current={activeSection === 'analytics' ? 'page' : undefined}
              onClick={() => {
                setCategoriesOpen(false)
                onNavigate('analytics')
              }}
            >
              Аналитика
            </button>
            <button
              type="button"
              className={`${classes.navButton} ${activeSection === 'settings' ? classes.active : ''}`}
              aria-current={activeSection === 'settings' ? 'page' : undefined}
              onClick={() => {
                setCategoriesOpen(false)
                onNavigate('settings')
              }}
            >
              Настройки
            </button>
          </nav>
          <p className={classes.note} aria-label="Факт о коллекции">
            {fact}
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
