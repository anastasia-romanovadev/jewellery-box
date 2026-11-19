import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DICTIONARIES,
  DEFAULT_TEMPLATE,
  type CreationTemplate,
} from '../../../entities/template/model/template'
import { TemplateEditor } from './TemplateEditor'

function editor(
  template: CreationTemplate,
  onSave: (draft: CreationTemplate) => Promise<CreationTemplate>,
) {
  return (
    <MantineProvider>
      <TemplateEditor template={template} entries={DEFAULT_DICTIONARIES} onSave={onSave} />
    </MantineProvider>
  )
}

describe('template editor', () => {
  it('keeps a new field local until explicit save and preserves its name after a failed write', async () => {
    const save = vi
      .fn<(draft: CreationTemplate) => Promise<CreationTemplate>>()
      .mockRejectedValueOnce(new Error('Недостаточно места'))
      .mockImplementationOnce(async (draft) => ({ ...draft, revision: draft.revision + 1 }))
    render(editor(DEFAULT_TEMPLATE, save))
    fireEvent.click(screen.getByRole('button', { name: 'Шаблон новой карточки' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название нового поля' }), {
      target: { value: 'Застёжка' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле в шаблон' }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Название поля «Застёжка»' })).toHaveValue(
      'Застёжка',
    )
    expect(
      screen.queryByRole('button', { name: 'Удалить поле «Фотографии»' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить шаблон' }))
    expect(await screen.findByText('Недостаточно места')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Название поля «Застёжка»' })).toHaveValue(
      'Застёжка',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить шаблон' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Шаблон сохранён')
    expect(save.mock.calls[1][0].fields.find((field) => field.label === 'Застёжка')).toMatchObject({
      kind: 'text',
      required: false,
      scope: 'all',
    })
  })

  it('retains an unsaved revision when a newer template arrives and can discard the draft', async () => {
    const save = vi
      .fn<(draft: CreationTemplate) => Promise<CreationTemplate>>()
      .mockRejectedValue(new Error('Конфликт версий'))
    const initial = { ...DEFAULT_TEMPLATE, revision: 3 }
    const view = render(editor(initial, save))
    fireEvent.click(screen.getByRole('button', { name: 'Шаблон новой карточки' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название нового поля' }), {
      target: { value: 'Происхождение' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле в шаблон' }))
    view.rerender(editor({ ...initial, revision: 4 }, save))
    expect(screen.getByText('Шаблон изменён в другой вкладке')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить шаблон' }))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0].revision).toBe(3)
    expect(await screen.findByText('Конфликт версий')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменения' }))
    expect(
      screen.queryByRole('textbox', { name: 'Название поля «Происхождение»' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Шаблон изменён в другой вкладке')).not.toBeInTheDocument()
  })

  it('requires a selected type for a type-specific field and keeps its ID when renamed and hidden', async () => {
    const save = vi
      .fn<(draft: CreationTemplate) => Promise<CreationTemplate>>()
      .mockImplementation(async (draft) => ({ ...draft, revision: draft.revision + 1 }))
    render(editor(DEFAULT_TEMPLATE, save))
    fireEvent.click(screen.getByRole('button', { name: 'Шаблон новой карточки' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название нового поля' }), {
      target: { value: 'Замок' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Где показывать новое поле' }), {
      target: { value: 'selected' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле в шаблон' }))
    expect(screen.queryByRole('textbox', { name: 'Название поля «Замок»' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Серьги' }))
    fireEvent.click(screen.getByRole('button', { name: 'Добавить поле в шаблон' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить шаблон' }))
    await screen.findByRole('status')
    const original = save.mock.calls[0][0].fields.find((field) => field.label === 'Замок')
    expect(original?.scope).toEqual(['earrings'])
    fireEvent.change(screen.getByRole('textbox', { name: 'Название поля «Замок»' }), {
      target: { value: 'Застёжка' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Показывать поле «Застёжка»' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить шаблон' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][0].fields.find((field) => field.label === 'Застёжка')?.id).toBe(
      original?.id,
    )
  })
})

it('starts collapsed and retains checkbox drafts while collapsed until save', async () => {
  const save = vi
    .fn<(draft: CreationTemplate) => Promise<CreationTemplate>>()
    .mockImplementation(async (draft) => ({ ...draft, revision: draft.revision + 1 }))
  render(editor(DEFAULT_TEMPLATE, save))
  const toggle = screen.getByRole('button', { name: 'Шаблон новой карточки' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(
    screen.queryByRole('checkbox', { name: 'Показывать поле «Фотографии»' }),
  ).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(
    screen.queryByRole('button', { name: /Поднять поле|Опустить поле/ }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Показывать поле «Фотографии»' }))
  fireEvent.click(toggle)
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(toggle)
  expect(screen.getByRole('checkbox', { name: 'Показывать поле «Фотографии»' })).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить шаблон' }))
  await screen.findByRole('status')
  expect(save.mock.calls[0][0].fields.find((field) => field.id === 'photos')).toMatchObject({
    enabled: false,
    required: true,
  })
})
