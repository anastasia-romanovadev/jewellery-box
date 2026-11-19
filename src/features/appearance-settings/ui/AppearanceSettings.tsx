import {
  ACCENT_OPTIONS,
  THEME_OPTIONS,
  type AccentTone,
  type ThemeMode,
} from '../../../shared/config/appearance'
import { ChoiceGroup } from './ChoiceGroup'
import classes from './AppearanceSettings.module.scss'

type AppearanceSettingsProps = {
  disabled?: boolean
  themeMode: ThemeMode
  onThemeChange: (value: ThemeMode) => void
  accentTone: AccentTone
  onAccentChange: (value: AccentTone) => void
}

export function AppearanceSettings({
  disabled = false,
  themeMode,
  onThemeChange,
  accentTone,
  onAccentChange,
}: AppearanceSettingsProps) {
  return (
    <fieldset className={classes.grid} disabled={disabled} aria-label="Оформление">
      <section className={classes.group} aria-labelledby="theme-setting-title">
        <h2 id="theme-setting-title" className={classes.title}>
          Тема
        </h2>
        <ChoiceGroup
          label="Тема"
          name="theme-mode"
          value={themeMode}
          options={THEME_OPTIONS}
          onChange={(value) => {
            if (value === 'system' || value === 'light' || value === 'dark') {
              onThemeChange(value)
            }
          }}
        />
      </section>

      <section className={classes.group} aria-labelledby="accent-setting-title">
        <h2 id="accent-setting-title" className={classes.title}>
          Акцент
        </h2>
        <div className={classes.swatches}>
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${classes.swatch} ${accentTone === option.value ? classes.selected : ''}`}
              style={{ backgroundColor: option.accent }}
              aria-label={option.label}
              aria-pressed={accentTone === option.value}
              title={option.label}
              onClick={() => onAccentChange(option.value)}
            />
          ))}
        </div>
      </section>
    </fieldset>
  )
}
