import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DICTIONARIES,
  type DictionaryEntry,
} from '../../../entities/template/model/template'
import { DictionaryEditor } from './DictionaryEditor'

function editor(
  onSave: (draft: DictionaryEntry) => Promise<DictionaryEntry>,
  entries = DEFAULT_DICTIONARIES,
) {
  return (
    <MantineProvider>
      <DictionaryEditor entries={entries} onSave={onSave} />
    </MantineProvider>
  )
}

describe('dictionary editor', () => {
  it('keeps old generation and draft across restore until explicit reset', async () => {
    const save = vi
      .fn<(draft: DictionaryEntry, generation?: number) => Promise<DictionaryEntry>>()
      .mockRejectedValueOnce(new Error('Конфликт восстановления'))
      .mockImplementation(async (draft) => ({ ...draft, revision: 1 }))
    const session = (generation: number) => (
      <MantineProvider>
        <DictionaryEditor entries={DEFAULT_DICTIONARIES} generation={generation} onSave={save} />
      </MantineProvider>
    )
    const view = render(session(0))
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    fireEvent.change(screen.getByLabelText('Название варианта'), {
      target: { value: 'Мой материал' },
    })
    view.rerender(session(1))
    expect(screen.getByLabelText('Название варианта')).toHaveValue('Мой материал')
    fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
    await screen.findByText('Конфликт восстановления')
    expect(save.mock.calls[0][1]).toBe(0)
    fireEvent.click(
      screen.getByRole('button', { name: 'Отменить черновики и загрузить справочники' }),
    )
    expect(screen.getByLabelText('Название варианта')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Название варианта'), {
      target: { value: 'Новый материал' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
    await screen.findByText('Справочник сохранён.')
    expect(save.mock.calls[1][1]).toBe(1)
  })

  it.each(['cancel', 'save'])('restores focus to the row after %s', async (action) => {
    const save = vi
      .fn<(draft: DictionaryEntry) => Promise<DictionaryEntry>>()
      .mockImplementation(async (draft) => ({ ...draft, revision: draft.revision + 1 }))
    render(editor(save))
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    fireEvent.click(screen.getByRole('button', { name: 'Изменить «Белое золото»' }))
    const button = screen.getByRole('button', {
      name: action === 'cancel' ? 'Отменить редактирование' : 'Сохранить вариант',
    })
    button.focus()
    fireEvent.click(button)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Изменить «Белое золото»' })).toHaveFocus(),
    )
  })

  it('rejects Unicode-equivalent duplicates before calling storage', () => {
    const save = vi.fn<(draft: DictionaryEntry) => Promise<DictionaryEntry>>()
    render(
      editor(save, [{ id: 'test', kind: 'material', label: 'ABC', revision: 1, enabled: true }]),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название варианта' }), {
      target: { value: ' ａｂｃ ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
    expect(screen.getByText('Такое название уже есть в этом списке')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('rejects empty and duplicate names before saving', () => {
    const save = vi.fn<(draft: DictionaryEntry) => Promise<DictionaryEntry>>()
    render(editor(save))
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
    expect(screen.getByText('Введи название')).toBeInTheDocument()
    const material = DEFAULT_DICTIONARIES.find((entry) => entry.kind === 'material')
    if (!material) throw new Error('Expected a default material')
    fireEvent.change(screen.getByRole('textbox', { name: 'Название варианта' }), {
      target: { value: `  ${material.label.toUpperCase()}  ` },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
    expect(screen.getByText('Такое название уже есть в этом списке')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps an edited label and its original revision when a conflicting update arrives', async () => {
    const entry = DEFAULT_DICTIONARIES.find((value) => value.kind === 'material')
    if (!entry) throw new Error('Expected a default material')
    const save = vi
      .fn<(draft: DictionaryEntry) => Promise<DictionaryEntry>>()
      .mockRejectedValue(new Error('Конфликт версий'))
    const view = render(editor(save))
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    fireEvent.click(screen.getByRole('button', { name: `Изменить «${entry.label}»` }))
    fireEvent.change(screen.getByRole('textbox', { name: `Название варианта «${entry.label}»` }), {
      target: { value: 'Мой материал' },
    })
    view.rerender(
      editor(
        save,
        DEFAULT_DICTIONARIES.map((value) =>
          value.id === entry.id
            ? { ...value, revision: value.revision + 1, label: 'Другая редакция' }
            : value,
        ),
      ),
    )
    expect(screen.getByRole('textbox', { name: `Название варианта «${entry.label}»` })).toHaveValue(
      'Мой материал',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить вариант' }))
    expect((await screen.findByText('Конфликт версий')).closest('li')).not.toBeNull()
    expect(save.mock.calls[0][0]).toMatchObject({
      id: entry.id,
      revision: entry.revision,
      label: 'Мой материал',
    })
    expect(screen.getByRole('textbox', { name: `Название варианта «${entry.label}»` })).toHaveValue(
      'Мой материал',
    )
  })

  it('requires confirmation and deactivates rather than removing referenced entries', async () => {
    const entry = DEFAULT_DICTIONARIES.find((value) => value.kind === 'material')
    if (!entry) throw new Error('Expected a default material')
    const save = vi
      .fn<(draft: DictionaryEntry) => Promise<DictionaryEntry>>()
      .mockImplementation(async (draft) => ({ ...draft, revision: draft.revision + 1 }))
    render(editor(save))
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    fireEvent.click(screen.getByRole('button', { name: `Удалить «${entry.label}»` }))
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Старые карточки и их значения останутся без изменений')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Не удалять' }))
    expect(save).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: `Удалить «${entry.label}»` }))
    dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить удаление' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toEqual({ ...entry, enabled: false })
    expect(await screen.findByRole('status')).toHaveTextContent('Старые карточки сохранены')
  })
})

it('keeps creation and inline rename drafts independent', async () => {
  const entry = DEFAULT_DICTIONARIES.find((value) => value.kind === 'material')!
  const save = vi
    .fn<(draft: DictionaryEntry) => Promise<DictionaryEntry>>()
    .mockImplementation(async (draft) => ({ ...draft, revision: draft.revision + 1 }))
  render(editor(save))
  fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Название варианта' }), {
    target: { value: 'Новый материал' },
  })
  fireEvent.click(screen.getByRole('button', { name: `Изменить «${entry.label}»` }))
  const input = screen.getByRole('textbox', { name: `Название варианта «${entry.label}»` })
  expect(input.closest('li')).not.toBeNull()
  fireEvent.change(input, { target: { value: 'Другое название' } })
  expect(screen.getByRole('textbox', { name: 'Название варианта' })).toHaveValue('Новый материал')
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить вариант' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Изменить «Другое название»' })).toBeInTheDocument(),
  )
  expect(screen.getByRole('textbox', { name: 'Название варианта' })).toHaveValue('Новый материал')
  fireEvent.click(screen.getByRole('button', { name: 'Добавить вариант' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[0][0].id).toBe(entry.id)
  expect(save.mock.calls[1][0].id).not.toBe(entry.id)
  expect(save.mock.calls[1][0].label).toBe('Новый материал')
})
