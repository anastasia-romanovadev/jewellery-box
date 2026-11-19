import {
  ACCENT_OPTIONS,
  THEME_OPTIONS,
  type AccentTone,
  type ThemeMode,
} from '../../../shared/config/appearance'
import { ChoiceGroup } from './ChoiceGroup'
import classes from './AppearanceSettings.module.scss'

type AppearanceSettingsProps = {
  themeMode: ThemeMode
  onThemeChange: (value: ThemeMode) => void
  accentTone: AccentTone
  onAccentChange: (value: AccentTone) => void
}

export function AppearanceSettings({
  themeMode,
  onThemeChange,
  accentTone,
  onAccentChange,
}: AppearanceSettingsProps) {
  return (
    <div className={classes.grid}>
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

      <section className={classes.group} aria-labelledby="template-setting-title">
        <h2 id="template-setting-title" className={classes.title}>
          Шаблон
        </h2>
        <p>
          Шаблон определяет общие поля и поля по типам изделий для новых карточек. Редактор пока
          недоступен.
        </p>
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
    </div>
  )
}
