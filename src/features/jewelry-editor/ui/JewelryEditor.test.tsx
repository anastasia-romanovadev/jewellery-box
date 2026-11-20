import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  buildCardSnapshot,
  DEFAULT_DICTIONARIES,
  DEFAULT_TEMPLATE,
} from '../../../entities/template/model/template'
import type { JewelryItem } from '../../../entities/jewelry/model/item'
import { JewelryEditor } from './JewelryEditor'

describe('jewelry editor snapshot presentation', () => {
  for (const editing of [false, true]) {
    it.each(['ring', 'chain', 'earrings'])(
      `uses saved labels, units and field order when ${editing ? 'editing' : 'creating'} %s`,
      (typeId) => {
        const template = structuredClone(DEFAULT_TEMPLATE)
        const labels: Record<string, string> = editing
          ? {
              type: 'Вид украшения',
              photos: 'Снимки',
              weight: 'Масса',
              fineness: 'Маркировка',
              size: 'Габарит',
            }
          : {
              type: 'Тип изделия',
              photos: 'Фотографии',
              weight: 'Вес',
              fineness: 'Проба',
              size: 'Размер',
            }
        const order = [
          'weight',
          'photos',
          'size',
          'type',
          'materials',
          'fineness',
          'notes',
          'stones',
        ]
        template.fields = template.fields.map((field) => ({
          ...field,
          order: order.indexOf(field.id),
        }))
        const snapshot = buildCardSnapshot(template, DEFAULT_DICTIONARIES, typeId)
        // Historical snapshots have independent labels; current templates keep builtin names fixed.
        snapshot.fields = snapshot.fields.map((field) => ({
          ...field,
          label: labels[field.id] ?? field.label,
        }))
        snapshot.fields.reverse()
        const original = structuredClone(snapshot)
        const item: JewelryItem = {
          id: 'existing',
          revision: 1,
          typeId,
          snapshot,
          materialIds: ['gold-white'],
          stoneIds: [],
          finenessId: 'fineness-585',
          weightGrams: 3,
          notes: '',
          customValues: {},
          photoIds: [],
          createdAt: '2026-11-20T00:00:00.000Z',
          updatedAt: '2026-11-20T00:00:00.000Z',
        }
        render(
          <MantineProvider>
            <JewelryEditor
              item={editing ? item : undefined}
              catalog={{
                template: editing ? DEFAULT_TEMPLATE : template,
                entries: DEFAULT_DICTIONARIES,
              }}
              category={typeId}
              onClose={vi.fn()}
              onSaved={vi.fn()}
            />
          </MantineProvider>,
        )
        const weight = screen.getByRole('textbox', { name: `${labels.weight}, г` })
        const photos = screen.getByRole('region', { name: labels.photos })
        const size = screen.getByRole(typeId === 'earrings' ? 'combobox' : 'textbox', {
          name: typeId === 'chain' ? `${labels.size}, см` : labels.size,
        })
        const type = screen.getByRole('combobox', { name: labels.type })
        expect(screen.getByRole('combobox', { name: labels.fineness })).toBeVisible()
        expect(screen.getByRole('heading', { name: `${labels.photos} (0/5)` })).toBeVisible()
        for (const [before, after] of [
          [weight, photos],
          [photos, size],
          [size, type],
        ]) {
          expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
            0,
          )
        }
        expect(snapshot).toEqual(original)
      },
    )
  }

  it('omits photos when hidden in the creation template', () => {
    const template = structuredClone(DEFAULT_TEMPLATE)
    template.fields = template.fields.map((field) =>
      field.id === 'photos' ? { ...field, enabled: false } : field,
    )
    render(
      <MantineProvider>
        <JewelryEditor
          catalog={{ template, entries: DEFAULT_DICTIONARIES }}
          category="ring"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MantineProvider>,
    )
    expect(screen.queryByLabelText('Добавить фотографии из галереи')).not.toBeInTheDocument()
  })

  it('does not mark the form changed when a selected file is rejected', async () => {
    const close = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <MantineProvider>
        <JewelryEditor
          catalog={{ template: DEFAULT_TEMPLATE, entries: DEFAULT_DICTIONARIES }}
          category="ring"
          onClose={close}
          onSaved={vi.fn()}
        />
      </MantineProvider>,
    )
    fireEvent.change(screen.getByLabelText('Добавить фотографии из галереи'), {
      target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Выберите файл изображения')
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})
