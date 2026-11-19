import { InstallGuide } from '../../../features/install-guide/ui/InstallGuide'
import { CollectionGallery } from '../../../widgets/collection-gallery/ui/CollectionGallery'
import classes from './CollectionPage.module.scss'

type CollectionPageProps = {
  selectedCategory: string
  isInstallGuideVisible: boolean
  onDismissInstallGuide: () => void
}

export function CollectionPage({
  selectedCategory,
  isInstallGuideVisible,
  onDismissInstallGuide,
}: CollectionPageProps) {
  return (
    <section className={classes.page} aria-labelledby="collection-title">
      <header className={classes.intro}>
        <h1 id="collection-title">Личная шкатулка</h1>
        <p>Любимые украшения в одном месте — удобно смотреть и на телефоне, и на компьютере.</p>
      </header>
      {isInstallGuideVisible ? <InstallGuide dismiss={onDismissInstallGuide} /> : null}
      <CollectionGallery selectedCategory={selectedCategory} />
    </section>
  )
}
