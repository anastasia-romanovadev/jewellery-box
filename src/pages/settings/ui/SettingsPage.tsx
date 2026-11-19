import type { useAppearanceSettings } from '../../../features/appearance-settings/model/useAppearanceSettings'
import { SettingsPanel } from '../../../widgets/settings-panel/ui/SettingsPanel'
import classes from './SettingsPage.module.scss'

type SettingsPageProps = ReturnType<typeof useAppearanceSettings>

export function SettingsPage(settings: SettingsPageProps) {
  return (
    <section className={classes.page} aria-labelledby="settings-title">
      <header className={classes.intro}>
        <h1 id="settings-title">Настройки</h1>
        <p>Выберите тему и оформление. Инструкция установки всегда доступна здесь.</p>
      </header>
      <SettingsPanel {...settings} />
    </section>
  )
}
