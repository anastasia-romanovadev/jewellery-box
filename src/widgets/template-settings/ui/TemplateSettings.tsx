import { Alert, Button, Stack, Text } from '@mantine/core'
import { useCatalog } from '../../../data/useCatalog'
import {
  saveTemplate,
  saveDictionaryEntry,
  storageErrorMessage,
} from '../../../data/catalog-repository'
import { TemplateEditor } from '../../../features/template-editor/ui/TemplateEditor'
import { DictionaryEditor } from '../../../features/dictionary-editor/ui/DictionaryEditor'

export function TemplateSettings() {
  const { catalog, error, loading, retry } = useCatalog()

  return (
    <Stack>
      {error && (
        <Alert role="alert" title="Шаблон недоступен">
          {error}
          <Button onClick={retry}>Повторить загрузку шаблона</Button>
        </Alert>
      )}
      {loading && <Text role="status">Загружаю шаблон и справочники…</Text>}
      {catalog && (
        <TemplateEditor
          template={catalog.template}
          entries={catalog.entries}
          onSave={async (draft) => {
            try {
              return await saveTemplate(draft)
            } catch (reason) {
              throw new Error(storageErrorMessage(reason), { cause: reason })
            }
          }}
        />
      )}
      {catalog && (
        <DictionaryEditor
          entries={catalog.entries}
          generation={catalog.generation}
          onSave={async (draft, expectedGeneration) => {
            try {
              return await saveDictionaryEntry(draft, undefined, expectedGeneration)
            } catch (reason) {
              throw new Error(storageErrorMessage(reason), { cause: reason })
            }
          }}
        />
      )}
    </Stack>
  )
}
