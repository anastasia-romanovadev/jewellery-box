import classes from './InstallGuide.module.scss'

const IPHONE_STEPS = [
  'Открой Safari на iPhone.',
  'Открой в Safari ссылку на «Шкатулку». Если ссылка открылась внутри мессенджера, скопируй её, вставь в адресную строку Safari и нажми «Перейти».',
  'Нажми «Поделиться». Если его не видно, сначала открой меню страницы (кнопка с многоточием рядом с адресом), затем выбери «Поделиться».',
  'В открывшемся меню прокрути список действий вниз и выбери «На экран „Домой“». Если пункта нет, открой «Изменить действия» внизу списка и добавь его.',
  'Оставь название «Шкатулка». Если есть переключатель «Открывать как веб-приложение», включи его. Нажми «Добавить».',
  'Вернись на главный экран iPhone. Найди значок «Шкатулка» и нажми на него. В следующий раз открывай коллекцию этим же способом.',
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
      <p className={classes.intro}>
        Добавь значок на главный экран, чтобы открывать коллекцию одним нажатием.
      </p>
      <details className={classes.android} open={!dismiss}>
        <summary>Пошаговая инструкция установки</summary>
        <h3 className={classes.subtitle}>iPhone — Safari</h3>
        <ol className={classes.steps}>
          {IPHONE_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className={classes.intro}>
          Первый запуск выполни с интернетом и дождись сообщения «Приложение готово к работе без
          сети». После этого проверь открытие шкатулки в авиарежиме. Само добавление значка не
          подтверждает готовность к работе без сети.
        </p>
        <h3 className={classes.subtitle}>Android — Chrome</h3>
        <ol className={classes.steps}>
          <li>Открой ссылку на «Шкатулку» в Chrome, а не внутри мессенджера.</li>
          <li>
            Открой меню с тремя точками и выбери «Установить и создать ярлык» → «Установить». В
            некоторых версиях пункт называется «Добавить на главный экран».
          </li>
          <li>
            Подтверди добавление и открой «Шкатулку» с главного экрана. Дождись готовности к работе
            без сети.
          </li>
        </ol>
        <p className={classes.intro}>
          Названия пунктов могут различаться в зависимости от версии телефона. Для переноса
          коллекции используй резервную копию в настройках.
        </p>
        <p className={classes.intro}>
          Официальная помощь:{' '}
          <a
            href="https://support.apple.com/ru-ru/guide/iphone/iphea86e5236/ios"
            target="_blank"
            rel="noreferrer"
          >
            Apple
          </a>{' '}
          ·{' '}
          <a
            href="https://support.google.com/chrome/answer/9658361?hl=ru&amp;co=GENIE.Platform%3DAndroid"
            target="_blank"
            rel="noreferrer"
          >
            Google Chrome
          </a>
          .
        </p>
      </details>
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
