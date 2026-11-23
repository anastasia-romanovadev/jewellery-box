import type { CategoryFilterId } from '../entities/jewelry/model/jewelry'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Alert, Button, MantineProvider } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { CollectionPage } from '../pages/collection/ui/CollectionPage'
const SettingsPage = lazy(() =>
  import('../pages/settings/ui/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const AnalyticsPage = lazy(() =>
  import('../pages/analytics/ui/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
)
import { useAppearanceSettings } from '../features/appearance-settings/model/useAppearanceSettings'
import { useInstallGuide } from '../features/install-guide/model/useInstallGuide'
import { AppSidebar } from '../widgets/app-sidebar/ui/AppSidebar'
import classes from './App.module.scss'
import { useAppRoute, type AppRoute } from './model/useAppRoute'
import { useItems } from '../data/useItems'
import { analyzeCollection, collectionFacts } from '../entities/jewelry/model/analytics'
import { PwaStatus } from '../features/pwa/ui/PwaStatus'

export function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterId>('all')
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * 5))
  const collection = useItems()
  const analysis = useMemo(() => analyzeCollection(collection.items), [collection.items])
  const facts = useMemo(() => collectionFacts(analysis), [analysis])
  const isMobile = useMediaQuery('(max-width: 920px)', undefined, {
    getInitialValueInEffect: false,
  })
  const isModalOpen = isMobile && isSidebarOpen
  const { route, navigate } = useAppRoute()
  const appearanceSettings = useAppearanceSettings()
  const installGuide = useInstallGuide()

  function closeSidebar() {
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (!isModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isModalOpen])

  function handleNavigate(section: AppRoute) {
    if (navigate(section) && isSidebarOpen) closeSidebar()
  }

  return (
    <MantineProvider
      forceColorScheme={appearanceSettings.colorScheme}
      theme={{ fontFamily: 'var(--font-family)', headings: { fontFamily: 'var(--font-family)' } }}
    >
      <div className={classes.shell}>
        <AppSidebar
          fact={
            collection.error
              ? 'Не удалось загрузить статистику коллекции.'
              : collection.loading
                ? 'Считаю твою коллекцию…'
                : facts[factIndex % facts.length]
          }
          activeSection={route}
          isOpen={isModalOpen}
          selectedCategory={selectedCategory}
          onSelectCategory={(category) => {
            setSelectedCategory(category)
            handleNavigate('collection')
          }}
          onNavigate={(section) => {
            if (section === 'collection') navigate(section)
            else handleNavigate(section)
          }}
          onClose={closeSidebar}
        />
        <main className={classes.main} inert={isModalOpen}>
          <header className={classes.header}>
            <button
              type="button"
              className={classes.menuButton}
              aria-label="Открыть меню"
              aria-controls="main-sidebar"
              aria-expanded={isModalOpen}
              onClick={() => {
                setFactIndex((index) => (index + 1) % 5)
                setSidebarOpen(true)
              }}
            >
              Меню
            </button>
            <div className={classes.sectionLabel}>
              <span aria-hidden="true">•</span>
              {{ collection: 'Коллекция', analytics: 'Аналитика', settings: 'Настройки' }[route]}
            </div>
          </header>
          <div className={classes.content}>
            <PwaStatus allowUpdate={route === 'collection' && !appearanceSettings.disabled} />
            {appearanceSettings.saveFailed && (
              <Alert className={classes.saveError} role="alert" title="Настройки не сохранены">
                {appearanceSettings.storageError}
                <Button onClick={appearanceSettings.retrySave}>Повторить сохранение</Button>
                <Button onClick={appearanceSettings.reloadSettings}>
                  Загрузить сохранённые настройки
                </Button>
              </Alert>
            )}
            {appearanceSettings.cacheFailed && !appearanceSettings.saveFailed && (
              <Alert role="status" title="Оформление сохранено в базе">
                Не удалось обновить быстрый кэш. При запуске тема может применяться с задержкой.
                <Button onClick={appearanceSettings.retryCache}>Повторить обновление кэша</Button>
              </Alert>
            )}
            {route === 'collection' ? (
              <CollectionPage
                collection={collection}
                selectedCategory={selectedCategory}
                isInstallGuideVisible={installGuide.isVisible}
                onDismissInstallGuide={installGuide.dismiss}
              />
            ) : route === 'analytics' ? (
              <Suspense fallback={<p role="status">Загружаю аналитику…</p>}>
                <AnalyticsPage
                  analysis={analysis}
                  loading={collection.loading}
                  error={collection.error}
                  retry={collection.retry}
                />
              </Suspense>
            ) : (
              <Suspense fallback={<p role="status">Загружаю настройки…</p>}>
                <SettingsPage {...appearanceSettings} />
              </Suspense>
            )}
          </div>
        </main>
      </div>
    </MantineProvider>
  )
}
