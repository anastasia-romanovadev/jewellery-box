import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  buildCardSnapshot,
  DEFAULT_TEMPLATE,
  DEFAULT_DICTIONARIES,
} from '../../../entities/template/model/template'
import type { JewelryItem } from '../../../entities/jewelry/model/item'
import { JewelryDetails } from './JewelryDetails'

it('omits empty fields and missing material assays while retaining filled values including zero text', () => {
  const snapshot = buildCardSnapshot(DEFAULT_TEMPLATE, DEFAULT_DICTIONARIES, 'ring')
  snapshot.fields.push({
    id: 'shop',
    label: 'Магазин',
    kind: 'text',
    source: 'custom',
    enabled: true,
    required: false,
    protected: false,
    scope: 'all',
    order: 9,
  })
  snapshot.fields.push({
    id: 'code',
    label: 'Код',
    kind: 'text',
    source: 'custom',
    enabled: true,
    required: false,
    protected: false,
    scope: 'all',
    order: 10,
  })
  const item: JewelryItem = {
    id: 'test',
    revision: 1,
    snapshot,
    typeId: 'ring',
    materialIds: ['gold-white', 'gold-red'],
    materialFineness: { 'gold-white': 'fineness-gold-585' },
    stoneIds: [],
    photoIds: [],
    notes: '  \n ',
    customValues: { shop: '  ', code: '0' },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
  }
  const { container } = render(
    <MantineProvider>
      <JewelryDetails item={item} onClose={vi.fn()} onEdit={vi.fn()} />
    </MantineProvider>,
  )
  for (const label of ['Камни', 'Заметки', 'Вес', 'Размер', 'Магазин'])
    expect(screen.queryByText(label, { selector: 'dt' })).not.toBeInTheDocument()
  expect(screen.queryByText('Не указано')).not.toBeInTheDocument()
  expect(screen.queryByText('Без фотографии')).not.toBeInTheDocument()
  expect(screen.getByText('Белое золото: 585')).toBeVisible()
  expect(screen.getByText('0', { selector: 'dd' })).toBeVisible()
  expect(container.querySelectorAll('img')).toHaveLength(0)
})
