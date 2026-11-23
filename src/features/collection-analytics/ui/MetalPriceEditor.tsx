import { useState } from 'react'
import { Alert, Button, Group, TextInput } from '@mantine/core'
import { parsePriceInput, type MetalPrice } from '../../../entities/jewelry/model/pricing'
import { saveMetalPrice } from '../../../data/metal-price-repository'
import { storageErrorMessage } from '../../../data/catalog-repository'

export function MetalPriceEditor({
  value,
  generation = 0,
}: {
  value: MetalPrice
  generation?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [revision, setRevision] = useState(value.revision)
  const [draftGeneration, setDraftGeneration] = useState(generation)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy || draft === null) return
        let price: number | null
        try {
          price = parsePriceInput(draft)
        } catch (reason) {
          setError((reason as Error).message)
          return
        }
        setBusy(true)
        setError(null)
        try {
          await saveMetalPrice(
            { ...value, revision, pricePerGram: price },
            undefined,
            draftGeneration,
          )
          setDraft(null)
          setSaved(true)
        } catch (reason) {
          setError(storageErrorMessage(reason))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Group align="end" wrap="wrap">
        <TextInput
          label="Цена за грамм, ₽/г"
          inputMode="decimal"
          placeholder="Введи цену"
          style={{ flex: '1 1 180px' }}
          disabled={busy}
          value={draft ?? value.pricePerGram?.toString().replace('.', ',') ?? ''}
          onChange={(event) => {
            if (draft === null) {
              setRevision(value.revision)
              setDraftGeneration(generation)
            }
            setDraft(event.currentTarget.value)
            setSaved(false)
            setError(null)
          }}
        />
        <Button type="submit" color="var(--accent)" loading={busy} disabled={draft === null}>
          Сохранить цену
        </Button>
      </Group>
      {saved && <p role="status">Цена сохранена.</p>}
      {error && (
        <Alert color="red" role="alert">
          {error}
          {(revision !== value.revision || draftGeneration !== generation) && (
            <Button
              color="var(--accent)"
              onClick={() => {
                setDraft(null)
                setError(null)
                setSaved(false)
              }}
            >
              Загрузить сохранённую цену
            </Button>
          )}
        </Alert>
      )}
    </form>
  )
}
