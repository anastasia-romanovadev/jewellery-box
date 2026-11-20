import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import type { CategoryFilterId } from '../../../entities/jewelry/model/jewelry'
import { EMPTY_FILTERS, filterItems, type JewelryItem } from '../../../entities/jewelry/model/item'
import { InstallGuide } from '../../../features/install-guide/ui/InstallGuide'
import { CollectionGallery } from '../../../widgets/collection-gallery/ui/CollectionGallery'
import { CollectionFilters } from '../../../features/collection-filter/ui/CollectionFilters'
const JewelryEditor = lazy(() =>
  import('../../../features/jewelry-editor/ui/JewelryEditor').then((module) => ({
    default: module.JewelryEditor,
  })),
)
const JewelryDetails = lazy(() =>
  import('../../../features/jewelry-view/ui/JewelryDetails').then((module) => ({
    default: module.JewelryDetails,
  })),
)
import { useCatalog } from '../../../data/useCatalog'
import { useItems } from '../../../data/useItems'
import classes from './CollectionPage.module.scss'
type CollectionPageProps = {
  selectedCategory: CategoryFilterId
  isInstallGuideVisible: boolean
  onDismissInstallGuide: () => void
}
export function CollectionPage({
  selectedCategory,
  isInstallGuideVisible,
  onDismissInstallGuide,
}: CollectionPageProps) {
  const { catalog, error: catalogError, retry: retryCatalog } = useCatalog()
  const { items, error, loading, retry } = useItems()
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [editor, setEditor] = useState<{ item?: JewelryItem } | null>(null)
  const [viewed, setViewed] = useState<string | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const returnTarget = useRef<HTMLElement | null>(null)
  const hadDialog = useRef(false)
  const dialogOpen = editor !== null || viewed !== null
  useLayoutEffect(() => {
    if (hadDialog.current && !dialogOpen) {
      const target = returnTarget.current
      ;(target?.isConnected ? target : addButton.current)?.focus()
    }
    hadDialog.current = dialogOpen
  }, [dialogOpen])
  function rememberFocus() {
    returnTarget.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  const visible = filterItems(items, selectedCategory, filters)
  const item = items.find((item) => item.id === viewed)
  return (
    <section className={classes.page} aria-labelledby="collection-title">
      <header className={classes.intro}>
        <h1 id="collection-title">Личная шкатулка</h1>
        <p>Любимые украшения в одном месте — удобно смотреть и на телефоне, и на компьютере.</p>
      </header>
      {isInstallGuideVisible && <InstallGuide dismiss={onDismissInstallGuide} />}
      <Group justify="space-between">
        <Button
          disabled={!catalog || Boolean(catalogError)}
          ref={addButton}
          onClick={() => {
            rememberFocus()
            setEditor({})
          }}
        >
          Добавить украшение
        </Button>
        <span>
          {visible.length} из {items.length}
        </span>
      </Group>
      {(error || catalogError) && (
        <Alert role="alert" color="red">
          {error || catalogError}
          <Button
            onClick={() => {
              retry()
              retryCatalog()
            }}
          >
            Повторить загрузку
          </Button>
        </Alert>
      )}
      {catalog && (
        <CollectionFilters
          value={filters}
          entries={catalog.entries}
          items={items}
          onChange={setFilters}
        />
      )}
      {loading ? (
        <p role="status">Загружаем коллекцию…</p>
      ) : !items.length ? (
        <p role="status">В шкатулке пока нет украшений. Добавьте первое.</p>
      ) : !visible.length ? (
        <p role="status">По выбранным условиям украшений нет. Измените фильтры или категорию.</p>
      ) : (
        <CollectionGallery
          items={visible}
          onOpen={(item) => {
            rememberFocus()
            setViewed(item.id)
          }}
        />
      )}
      <Suspense fallback={<p role="status">Открываем карточку…</p>}>
        {item && !editor && (
          <JewelryDetails
            key={item.id}
            item={item}
            onClose={() => setViewed(null)}
            onEdit={() => {
              setViewed(null)
              setEditor({ item: structuredClone(item) })
            }}
          />
        )}
        {viewed && !item && !loading && (
          <Alert role="status">
            Карточка больше недоступна.<Button onClick={() => setViewed(null)}>Закрыть</Button>
          </Alert>
        )}
        {editor && catalog && (
          <JewelryEditor
            item={editor.item}
            catalog={catalog}
            category={selectedCategory}
            onClose={() => setEditor(null)}
            onSaved={() => {
              setEditor(null)
              setViewed(null)
            }}
          />
        )}
      </Suspense>
    </section>
  )
}
