import { useState } from 'react'
import { Alert, Button, Modal, TextInput } from '@mantine/core'
import classes from './AppearanceComponentPreview.module.scss'

export function AppearanceComponentPreview() {
  const [dialogOpened, setDialogOpened] = useState(false)

  return (
    <section className={classes.preview} aria-labelledby="component-preview-title">
      <div>
        <h2 id="component-preview-title" className={classes.title}>
          Проверка оформления
        </h2>
        <p className={classes.description}>
          Пример поля, кнопки, сообщения об ошибке и диалога в выбранной теме.
        </p>
      </div>
      <div className={classes.controls}>
        <TextInput label="Название украшения" placeholder="Например, кольцо с гранатом" />
        <Button onClick={() => setDialogOpened(true)}>Открыть диалог</Button>
      </div>
      <Alert className={classes.error} title="Ошибка сохранения" role="alert">
        Изменения не сохранены. Попробуйте ещё раз.
      </Alert>
      <Modal
        opened={dialogOpened}
        onClose={() => setDialogOpened(false)}
        title="Пример диалога"
        closeButtonProps={{ 'aria-label': 'Закрыть диалог' }}
        centered
      >
        <p className={classes.dialogText}>Диалог также использует выбранную цветовую тему.</p>
        <Button onClick={() => setDialogOpened(false)}>Закрыть</Button>
      </Modal>
    </section>
  )
}
