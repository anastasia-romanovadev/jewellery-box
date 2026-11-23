import 'fake-indexeddb/auto'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database } from '../../../data/database'
import * as repository from '../../../data/catalog-repository'
import { TemplateSettings } from './TemplateSettings'

beforeEach(async () => {
  // Only the fake-indexeddb singleton imported above is reset.
  await database.delete()
  await database.open()
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await database.delete()
})

it('retains both editor drafts across a live read failure, retry loading and recovery', async () => {
  render(
    <MantineProvider>
      <TemplateSettings />
    </MantineProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблон новой карточки' }))
  fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
  const newField = await screen.findByRole('textbox', { name: 'Название нового поля' })
  fireEvent.change(newField, { target: { value: 'Застёжка' } })
  fireEvent.click(screen.getByRole('button', { name: 'Добавить поле в шаблон' }))
  const material = (await repository.readCatalog()).entries.find(
    (entry) => entry.kind === 'material',
  )
  if (!material) throw new Error('Expected a default material')
  fireEvent.click(screen.getByRole('button', { name: `Изменить «${material.label}»` }))
  fireEvent.change(screen.getByRole('textbox', { name: `Название варианта «${material.label}»` }), {
    target: { value: 'Мой материал' },
  })
  const assertDrafts = () => {
    expect(screen.getByRole('textbox', { name: 'Название поля «Застёжка»' })).toHaveValue(
      'Застёжка',
    )
    expect(
      screen.getByRole('textbox', { name: `Название варианта «${material.label}»` }),
    ).toHaveValue('Мой материал')
  }
  const read = vi.spyOn(repository, 'readCatalog').mockRejectedValue(new Error('Read failed'))
  await act(async () => {
    await database.templates.update('creation', { revision: 2 })
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось обратиться к хранилищу')
  assertDrafts()

  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const initialize = vi.spyOn(repository, 'initializeDatabase').mockReturnValueOnce(pending)
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку шаблона' }))
  await waitFor(() => expect(initialize).toHaveBeenCalled())
  expect(screen.getByRole('status')).toHaveTextContent('Загружаю шаблон')
  assertDrafts()
  read.mockRestore()
  await act(async () => {
    release()
    await pending
  })
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  expect(screen.queryByText('Шаблон недоступен')).not.toBeInTheDocument()
  expect(screen.getByText('Шаблон изменён в другой вкладке')).toBeInTheDocument()
  assertDrafts()
  expect(
    (await repository.readCatalog()).template.fields.some((field) => field.label === 'Застёжка'),
  ).toBe(false)
  expect(
    (await repository.readCatalog()).entries.find((entry) => entry.id === material.id)?.label,
  ).toBe(material.label)
})
