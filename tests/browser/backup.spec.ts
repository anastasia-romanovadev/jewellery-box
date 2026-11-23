import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
  'base64',
)
async function create(page: Page, note: string) {
  await page.goto('/#/collection')
  await page.getByRole('button', { name: 'Добавить украшение', exact: true }).click()
  await page.getByRole('textbox', { name: 'Материалы', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('option', { name: 'Белое золото', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Проба — Белое золото', exact: true })
    .selectOption('fineness-gold-585')
  await page.getByRole('textbox', { name: 'Вес, г', exact: true }).fill('3')
  await page.getByRole('textbox', { name: 'Заметки', exact: true }).fill(note)
  await page
    .getByLabel('Добавить фотографии из галереи')
    .setInputFiles({ name: 'original.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('heading', { name: 'Фотографии (1/5)' })).toBeVisible()
  await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

for (const theme of ['light', 'dark'] as const) {
  test(`backup replaces another collection and works offline, ${theme}`, async ({ browser }) => {
    const source = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      colorScheme: theme,
    })
    const target = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      colorScheme: theme,
    })
    const page = await source.newPage()
    await create(page, 'Исходная карточка')
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Подготовить резервную копию', exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать ZIP', exact: true }).click()
    const archive = await download
    const buffer = await readFile((await archive.path())!)
    const other = await target.newPage()
    await create(other, 'Заменяемая карточка')
    await other.goto('/#/settings')
    const file = { name: 'backup.zip', mimeType: 'application/zip', buffer }
    await other.getByLabel('Файл резервной копии').setInputFiles(file)
    const dialog = other.getByRole('dialog', { name: 'Восстановить шкатулку из копии?' })
    await expect(dialog).toContainText('украшений — 1, фотографий — 1')
    await dialog.screenshot({ path: `test-results/backup-preview-${theme}.png` })
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await other
      .getByLabel('Файл резервной копии')
      .setInputFiles({ ...file, buffer: Buffer.from('broken') })
    await expect(other.getByRole('alert').filter({ hasText: 'Не удалось завершить' })).toBeVisible()
    await other.getByLabel('Файл резервной копии').setInputFiles(file)
    await dialog
      .getByRole('button', { name: 'Заменить данные и восстановить', exact: true })
      .click()
    await expect(
      other.getByText('Шкатулка восстановлена из резервной копии.', { exact: true }),
    ).toBeVisible()
    await other.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await target.setOffline(true)
    await other.reload()
    await expect(other.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Подготовить резервную копию', exact: true }).click()
    await expect(other.getByRole('button', { name: 'Скачать ZIP', exact: true })).toBeVisible()
    await other.goto('/#/collection')
    await expect(other.getByText('1 из 1', { exact: true })).toBeVisible()
    await other.getByRole('button', { name: /^Открыть: Кольца/ }).click()
    await expect(other.getByRole('dialog')).toContainText('Исходная карточка')
    await expect(other.getByRole('dialog')).not.toContainText('Заменяемая карточка')
    await expect(other.getByRole('dialog').locator('img')).toBeVisible()
    await other.screenshot({ path: `test-results/backup-offline-${theme}.png` })
    await source.close()
    await target.close()
  })
}
