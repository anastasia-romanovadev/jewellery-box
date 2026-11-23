import type { useAppearanceSettings } from '../../../features/appearance-settings/model/useAppearanceSettings'
import { SettingsPanel } from '../../../widgets/settings-panel/ui/SettingsPanel'
import { BackupPanel } from '../../../features/backup/ui/BackupPanel'
import classes from './SettingsPage.module.scss'

type SettingsPageProps = ReturnType<typeof useAppearanceSettings>

export function SettingsPage(settings: SettingsPageProps) {
  return (
    <section className={classes.page} aria-labelledby="settings-title">
      <header className={classes.intro}>
        <h1 id="settings-title">Настройки</h1>
        <p>
          По любым вопросам и проблемам, связанным с приложением, у вас есть персональная служба
          поддержки «Дочь», к которой вы можете обратиться любым удобным способом 24/7.
        </p>
      </header>
      <SettingsPanel {...settings} />
      <BackupPanel />
    </section>
  )
}
