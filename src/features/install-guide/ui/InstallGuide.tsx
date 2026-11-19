import classes from './InstallGuide.module.scss'

const INSTALLATION_STEPS = [
  'Откройте меню браузера и выберите «На главный экран».',
  'Подтвердите добавление ярлыка на главный экран.',
  'Запускайте шкатулку с нового ярлыка.',
]

type InstallGuideProps = {
  dismiss?: () => void
}

export function InstallGuide({ dismiss }: InstallGuideProps) {
  return (
    <section className={classes.guide} aria-labelledby="install-guide-title">
      <h2 id="install-guide-title" className={classes.title}>
        Как установить на телефон
      </h2>
      <ol className={classes.steps}>
        {INSTALLATION_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {dismiss ? (
        <button
          type="button"
          className={classes.close}
          aria-label="Скрыть инструкцию установки"
          onClick={dismiss}
        >
          ×
        </button>
      ) : null}
    </section>
  )
}
