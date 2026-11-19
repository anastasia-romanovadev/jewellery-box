import { useEffect, useState } from 'react'
import { Alert, Button, MantineProvider } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { CollectionPage } from '../pages/collection/ui/CollectionPage'
import { SettingsPage } from '../pages/settings/ui/SettingsPage'
import { useAppearanceSettings } from '../features/appearance-settings/model/useAppearanceSettings'
import { useInstallGuide } from '../features/install-guide/model/useInstallGuide'
import { AppSidebar } from '../widgets/app-sidebar/ui/AppSidebar'
import classes from './App.module.scss'
import { useAppRoute } from './model/useAppRoute'

export function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Все')
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

  function handleNavigate(section: 'collection' | 'settings') {
    navigate(section)
    if (isSidebarOpen) closeSidebar()
  }

  return (
    <MantineProvider
      forceColorScheme={appearanceSettings.colorScheme}
      theme={{ fontFamily: 'var(--font-family)', headings: { fontFamily: 'var(--font-family)' } }}
    >
      <div className={classes.shell}>
        <AppSidebar
          activeSection={route}
          isOpen={isModalOpen}
          selectedCategory={selectedCategory}
          onSelectCategory={(category) => {
            setSelectedCategory(category)
            handleNavigate('collection')
          }}
          onNavigate={handleNavigate}
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
              onClick={() => setSidebarOpen(true)}
            >
              Меню
            </button>
            <div className={classes.sectionLabel}>
              <span aria-hidden="true">•</span>
              {route === 'collection' ? 'Коллекция' : 'Настройки'}
            </div>
          </header>
          <div className={classes.content}>
            {appearanceSettings.saveFailed && (
              <Alert className={classes.saveError} role="alert" title="Настройки не сохранены">
                Выбранное оформление действует сейчас, но может сброситься после перезагрузки.
                <Button onClick={appearanceSettings.retrySave}>Повторить сохранение</Button>
              </Alert>
            )}
            {route === 'collection' ? (
              <CollectionPage
                selectedCategory={selectedCategory}
                isInstallGuideVisible={installGuide.isVisible}
                onDismissInstallGuide={installGuide.dismiss}
              />
            ) : (
              <SettingsPage {...appearanceSettings} />
            )}
          </div>
        </main>
      </div>
    </MantineProvider>
  )
}
