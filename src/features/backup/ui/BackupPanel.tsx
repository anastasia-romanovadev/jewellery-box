import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Modal, Stack } from '@mantine/core'
import {
  exportBackup,
  inspectBackup,
  restoreBackup,
  type ValidatedBackup,
} from '../../../data/backup-repository'
import { BEFORE_NAVIGATE } from '../../../shared/lib/navigation-guard'
import { downloadPhotoFile } from '../../jewelry-view/model/photo-export'
import classes from './BackupPanel.module.scss'

function failureMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'Не удалось выполнить операцию. Попробуй ещё раз.'
}

export function BackupPanel() {
  const input = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ValidatedBackup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [storageNotice, setStorageNotice] = useState<string | null>(null)

  useEffect(() => {
    function navigate(event: Event) {
      if (running.current) event.preventDefault()
    }
    function unload(event: BeforeUnloadEvent) {
      if (running.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener(BEFORE_NAVIGATE, navigate)
    window.addEventListener('beforeunload', unload)
    return () => {
      window.removeEventListener(BEFORE_NAVIGATE, navigate)
      window.removeEventListener('beforeunload', unload)
    }
  }, [])

  async function perform(label: string, action: () => Promise<void>) {
    if (running.current) return
    running.current = true
    setBusy(label)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError'))
        setError(failureMessage(reason))
    } finally {
      running.current = false
      setBusy(null)
    }
  }

  function prepare() {
    void perform('Подготавливаю резервную копию…', async () => {
      setFile(null)
      const blob = await exportBackup()
      setFile(
        new File([blob], `jewellery-box-${new Date().toISOString().slice(0, 10)}.zip`, {
          type: 'application/zip',
        }),
      )
      setNotice('Копия подготовлена. Сохрани файл на телефон или передай на другое устройство.')
    })
  }

  const sharing =
    file &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  const feedback = (
    <>
      {busy && <p role="status">{busy}</p>}
      {error && (
        <Alert role="alert" title="Не удалось завершить">
          {error}
        </Alert>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  )
  const exportControls = (
    <Stack gap="sm">
      <Button disabled={Boolean(busy)} onClick={prepare}>
        Подготовить резервную копию
      </Button>
      {file && (
        <>
          <p>
            Подготовлено:{' '}
            {(file.size / 1024 / 1024).toLocaleString('ru', { maximumFractionDigits: 1 })} МБ.
            Снимок коллекции на момент подготовки.
          </p>
          <Group>
            {sharing && (
              <Button
                disabled={Boolean(busy)}
                onClick={() =>
                  void perform('Открываю системное меню…', async () => {
                    await navigator.share({ files: [file] })
                  })
                }
              >
                Сохранить или передать файл
              </Button>
            )}
            <Button
              variant="default"
              disabled={Boolean(busy)}
              onClick={() => {
                downloadPhotoFile(file, file.name)
                setNotice('Файл передан браузеру для скачивания. Проверь папку загрузок.')
              }}
            >
              Скачать ZIP
            </Button>
          </Group>
        </>
      )}
    </Stack>
  )

  return (
    <section className={classes.panel} aria-labelledby="backup-title">
      <h2 id="backup-title">Резервная копия и перенос</h2>
      <p>
        Сохрани всю шкатулку одним файлом: украшения, оригиналы фотографий, шаблон, справочники,
        оформление и цены металлов. Копию можно перенести на другой телефон.
      </p>
      <p>
        Текущий предел копии — 256 МиБ. На телефоне с небольшим объёмом памяти подготовка большой
        копии может не завершиться; исходные данные останутся в шкатулке.
      </p>
      {!preview && (
        <>
          {feedback}
          {exportControls}
        </>
      )}
      <Button variant="default" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
        Открыть резервную копию
      </Button>
      <input
        ref={input}
        hidden
        aria-label="Файл резервной копии"
        type="file"
        accept=".zip,application/zip"
        disabled={Boolean(busy)}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selected)
            void perform('Проверяю резервную копию…', async () => {
              setPreview(await inspectBackup(selected))
            })
        }}
      />
      <p>
        Для переноса: подготовь и сохрани ZIP, передай его на другой телефон, открой там «Настройки
        → Резервная копия и перенос» и выбери файл. Исходная шкатулка останется без изменений.
      </p>
      {typeof navigator.storage?.persist === 'function' && (
        <Button
          variant="default"
          disabled={Boolean(busy)}
          onClick={() =>
            void perform('Проверяю защиту хранения…', async () => {
              const granted = await navigator.storage.persist()
              setStorageNotice(
                granted
                  ? 'Браузер разрешил постоянное хранение. Резервную копию всё равно сохраняй отдельно.'
                  : 'Браузер не предоставил постоянное хранение. Шкатулка продолжает работать; сохраняй резервные копии отдельно.',
              )
            })
          }
        >
          Запросить постоянное хранение
        </Button>
      )}
      {storageNotice && <p role="status">{storageNotice}</p>}
      <Modal
        opened={preview !== null}
        onClose={() => {
          if (!running.current) {
            setPreview(null)
            setError(null)
            setNotice(null)
          }
        }}
        title="Восстановить шкатулку из копии?"
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        closeButtonProps={{ 'aria-label': 'Отменить восстановление', disabled: Boolean(busy) }}
      >
        {preview && (
          <Stack className={classes.preview}>
            <p>
              Копия от {new Date(preview.summary.exportedAt).toLocaleString('ru')}: украшений —{' '}
              {preview.summary.items}, фотографий — {preview.summary.photos}.
            </p>
            <Alert title="Полная замена данных">
              Все текущие украшения, фотографии и настройки будут заменены содержимым копии.
              Объединения коллекций нет. Перед заменой сохрани текущую шкатулку, если она тебе
              нужна.
            </Alert>
            {feedback}
            {exportControls}
            <Group>
              <Button
                disabled={Boolean(busy)}
                onClick={() =>
                  void perform('Восстанавливаю шкатулку…', async () => {
                    await restoreBackup(preview)
                    setPreview(null)
                    setFile(null)
                    setNotice('Шкатулка восстановлена из резервной копии.')
                  })
                }
              >
                Заменить данные и восстановить
              </Button>
              <Button
                variant="default"
                disabled={Boolean(busy)}
                onClick={() => {
                  setPreview(null)
                  setError(null)
                  setNotice(null)
                }}
              >
                Отмена
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </section>
  )
}
