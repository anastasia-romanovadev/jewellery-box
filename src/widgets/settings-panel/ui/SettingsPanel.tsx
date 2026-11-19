import { AppearanceSettings } from '../../../features/appearance-settings/ui/AppearanceSettings'
import { InstallGuide } from '../../../features/install-guide/ui/InstallGuide'
import type { useAppearanceSettings } from '../../../features/appearance-settings/model/useAppearanceSettings'
import { AppearanceComponentPreview } from '../../appearance-component-preview/ui/AppearanceComponentPreview'
import classes from './SettingsPanel.module.scss'

type SettingsPanelProps = ReturnType<typeof useAppearanceSettings>

export function SettingsPanel(settings: SettingsPanelProps) {
  return (
    <div className={classes.panel}>
      <AppearanceSettings
        themeMode={settings.themeMode}
        onThemeChange={settings.setThemeMode}
        accentTone={settings.accentTone}
        onAccentChange={settings.setAccentTone}
      />
      <InstallGuide />
      <AppearanceComponentPreview />
    </div>
  )
}
