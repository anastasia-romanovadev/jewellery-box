import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MetalPriceEditor } from './MetalPriceEditor'
import { ConflictError } from '../../../data/catalog-repository'

const save = vi.hoisted(() => vi.fn())
vi.mock('../../../data/metal-price-repository', () => ({ saveMetalPrice: save }))

it('retains a new-price draft generation after restore and allows explicit reset', async () => {
  save.mockRejectedValueOnce(new ConflictError()).mockResolvedValueOnce(undefined)
  const editor = (generation: number) => (
    <MantineProvider>
      <MetalPriceEditor
        generation={generation}
        value={{ id: 'gold', revision: 0, pricePerGram: null }}
      />
    </MantineProvider>
  )
  const view = render(editor(0))
  fireEvent.change(screen.getByLabelText('Цена за грамм, ₽/г'), { target: { value: '100' } })
  view.rerender(editor(1))
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить цену' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('другой вкладке')
  expect(save.mock.calls[0][2]).toBe(0)
  expect(screen.getByLabelText('Цена за грамм, ₽/г')).toHaveValue('100')
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить сохранённую цену' }))
  fireEvent.change(screen.getByLabelText('Цена за грамм, ₽/г'), { target: { value: '200' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить цену' }))
  await screen.findByText('Цена сохранена.')
  expect(save.mock.calls[1][2]).toBe(1)
})
