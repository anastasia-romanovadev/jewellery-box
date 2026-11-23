import { expect, test } from '@playwright/test'
import {
  buildCardSnapshot,
  DEFAULT_DICTIONARIES,
  DEFAULT_TEMPLATE,
} from '../../src/entities/template/model/template'
import type { JewelryItem } from '../../src/entities/jewelry/model/item'

for (const theme of ['light', 'dark'] as const) {
  test(`new choices use live labels while saved choices keep history, ${theme}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      colorScheme: theme,
    })
    const page = await context.newPage()
    await page.goto('/#/settings')
    await expect(page.getByRole('button', { name: 'Справочники', exact: true })).toBeVisible()
    const template = structuredClone(DEFAULT_TEMPLATE)
    template.fields = template.fields.map((field) =>
      field.id === 'photos' ? { ...field, enabled: false } : field,
    )
    const item: JewelryItem = {
      id: 'label-regression',
      revision: 1,
      typeId: 'ring',
      snapshot: buildCardSnapshot(template, DEFAULT_DICTIONARIES, 'ring'),
      materialIds: ['gold-white'],
      stoneIds: ['pearl'],
      materialFineness: { 'gold-white': 'fineness-gold-585' },
      weightGrams: 3,
      notes: '',
      customValues: {},
      photoIds: [],
      createdAt: '2026-11-23T00:00:00.000Z',
      updatedAt: '2026-11-23T00:00:00.000Z',
    }
    const renamed: Record<string, string> = {
      ruby: 'Новый рубин',
      silver: 'Новое серебро',
      'fineness-gold-750': 'Новая 750',
      pearl: 'Новый жемчуг',
      'gold-white': 'Новое белое золото',
      'fineness-gold-585': 'Новая 585',
    }
    const entries = DEFAULT_DICTIONARIES.map((entry) => ({
      ...entry,
      label: renamed[entry.id] ?? entry.label,
      enabled: !['pearl', 'gold-white', 'fineness-gold-585'].includes(entry.id),
      revision: entry.revision + 1,
    }))
    await page.evaluate(
      ({ item, entries }) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('jewellery-box')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const tx = db.transaction(['items', 'dictionaries'], 'readwrite')
            tx.objectStore('items').put(item)
            for (const entry of entries) tx.objectStore('dictionaries').put(entry)
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onabort = () => {
              db.close()
              reject(tx.error)
            }
          }
        }),
      { item, entries },
    )
    await page.goto('/#/collection')
    // The fixture writes through IndexedDB directly, outside Dexie's live-query notifications.
    await page.reload()
    await page.getByRole('button', { name: /^Открыть: Кольца/ }).tap()
    await page.getByRole('button', { name: 'Редактировать', exact: true }).tap()
    const pills = page.locator('.mantine-Pill-label')
    await expect(pills).toHaveText(['Белое золото', 'Жемчуг'])
    const goldAssay = page.getByRole('combobox', { name: 'Проба — Белое золото', exact: true })
    await expect(goldAssay.locator('option:checked')).toHaveText('585')
    for (const [field, label] of [
      ['Камни', 'Новый рубин'],
      ['Материалы', 'Новое серебро'],
    ]) {
      await page.getByRole('textbox', { name: field, exact: true }).focus()
      await page.keyboard.press('ArrowDown')
      await page.getByRole('option', { name: label, exact: true }).tap()
      await page.getByRole('textbox', { name: 'Вес, г', exact: true }).tap()
      await expect(pills.filter({ hasText: label })).toHaveCount(1)
    }
    await goldAssay.selectOption('fineness-gold-750')
    await expect(goldAssay.locator('option:checked')).toHaveText('Новая 750')
    await page
      .getByRole('combobox', { name: 'Проба — Новое серебро', exact: true })
      .selectOption('fineness-silver-925')
    await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'Редактировать украшение' })).toBeHidden()
    await page.reload()
    await page.getByRole('button', { name: /^Открыть: Кольца/ }).tap()
    await page.getByRole('button', { name: 'Редактировать', exact: true }).tap()
    await expect(pills).toHaveText(['Белое золото', 'Новое серебро', 'Жемчуг', 'Новый рубин'])
    await expect(goldAssay.locator('option:checked')).toHaveText('Новая 750')
    await context.close()
  })
}
