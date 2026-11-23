import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

test.use({ hasTouch: true })

const first = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
  'base64',
)
const second = Buffer.concat([first, Buffer.from('second original')])

async function createCard(page: Page) {
  await page.goto('/#/collection')
  await expect(page.getByRole('heading', { name: 'Личная шкатулка' })).toBeVisible()
  await page.getByRole('button', { name: 'Добавить украшение', exact: true }).click()
  await page.getByRole('textbox', { name: 'Материалы', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('option', { name: 'Белое золото', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Проба — Белое золото', exact: true })
    .selectOption('fineness-gold-585')
  await page.getByRole('textbox', { name: 'Вес, г', exact: true }).fill('3')
  await page.getByRole('textbox', { name: 'Заметки', exact: true }).fill('   ')
  await page.getByLabel('Добавить фотографии из галереи').setInputFiles([
    { name: 'same.png', mimeType: 'image/png', buffer: first },
    { name: 'same.png', mimeType: 'image/png', buffer: second },
  ])
  await expect(page.getByRole('heading', { name: 'Фотографии (2/5)' })).toBeVisible()
  await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Открыть: Кольца, Белое золото', exact: true }).click()
}

for (const theme of ['light', 'dark'] as const) {
  test(`empty fields stay hidden; current photo and all originals download, ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    })
    await createCard(page)
    const details = page.getByRole('dialog', { name: 'Кольца', exact: true })
    const saveDialog = page.getByRole('dialog', { name: 'Сохранить фотографии', exact: true })
    await expect(details.locator('dt')).toHaveText(['Материалы', 'Проба', 'Вес'])
    await expect(details.getByText('Не указано', { exact: true })).toHaveCount(0)
    await details.getByRole('button', { name: 'Фото 2', exact: true }).click()
    await details.getByRole('button', { name: 'Сохранить фото', exact: true }).click()
    await expect(
      saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }),
    ).toBeEnabled()
    const oneDownload = page.waitForEvent('download')
    await saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }).click()
    const one = await oneDownload
    expect(one.suggestedFilename()).toBe('02-same.png')
    expect(await readFile((await one.path())!)).toEqual(second)
    await expect(saveDialog).toBeHidden()
    await expect(details.getByRole('button', { name: 'Сохранить фото', exact: true })).toBeFocused()
    await details.getByRole('button', { name: 'Сохранить фото', exact: true }).tap()
    await expect(saveDialog).toHaveCSS('opacity', '1')
    await saveDialog.screenshot({ path: 'test-results/save-modal-' + theme + '.png' })
    const allDownload = page.waitForEvent('download')
    await saveDialog.getByRole('button', { name: 'Сохранить все фото (2)', exact: true }).tap()
    const all = await allDownload
    expect(all.suggestedFilename()).toBe('jewellery-photos.zip')
    const contents = unzipSync(new Uint8Array(await readFile((await all.path())!)))
    expect(Object.keys(contents)).toEqual(['01-same.png', '02-same.png'])
    expect(Buffer.from(contents['01-same.png'])).toEqual(first)
    expect(Buffer.from(contents['02-same.png'])).toEqual(second)
    await expect(saveDialog).toBeHidden()
    await expect(details.getByRole('button', { name: 'Сохранить фото', exact: true })).toBeFocused()
    await details.getByRole('button', { name: 'Открыть фотографию крупно' }).click()
    const viewer = page.getByRole('dialog', { name: 'Просмотр фотографии' })
    await viewer.getByRole('button', { name: 'Фото 1', exact: true }).click()
    await viewer.getByRole('button', { name: 'Сохранить фото', exact: true }).click()
    await expect(
      saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }),
    ).toBeEnabled()
    const viewerDownload = page.waitForEvent('download')
    await saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }).click()
    expect((await viewerDownload).suggestedFilename()).toBe('01-same.png')
    await expect(saveDialog).toBeHidden()
    await expect(viewer.getByRole('button', { name: 'Сохранить фото', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Закрыть просмотр фото', exact: true }).click()
    await expect(details).toBeVisible()
    await expect(details).toHaveCSS('opacity', '1')
    await details
      .getByRole('button', { name: 'Сохранить фото', exact: true })
      .scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/photo-save-${theme}.png` })
  })
}

test('native file sharing keeps activation; cancellation does not download and errors offer fallback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { mode: 'success', shared: [] as { names: string[]; activation: boolean }[] }
    Object.assign(window, { photoShareTest: state })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        if (state.mode === 'cancel') throw new DOMException('Cancelled', 'AbortError')
        if (state.mode === 'error') throw new DOMException('Denied', 'NotAllowedError')
        state.shared.push({
          names: data.files!.map((file) => file.name),
          activation: navigator.userActivation.isActive,
        })
      },
    })
  })
  await createCard(page)
  const details = page.getByRole('dialog', { name: 'Кольца', exact: true })
  const saveDialog = page.getByRole('dialog', { name: 'Сохранить фотографии', exact: true })
  await details.getByRole('button', { name: 'Фото 2', exact: true }).click()
  await details.getByRole('button', { name: 'Сохранить фото', exact: true }).click()
  await saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }).click()
  await expect(saveDialog).toBeHidden()
  await expect(details.getByRole('button', { name: 'Сохранить фото', exact: true })).toBeFocused()
  await details.getByRole('button', { name: 'Сохранить фото', exact: true }).tap()
  await saveDialog.getByRole('button', { name: 'Сохранить все фото (2)', exact: true }).click()
  await expect(saveDialog).toBeHidden()
  await details.getByRole('button', { name: 'Сохранить фото', exact: true }).tap()
  const shared = await page.evaluate(
    () => (window as unknown as { photoShareTest: { shared: unknown } }).photoShareTest.shared,
  )
  expect(shared).toEqual([
    { names: ['02-same.png'], activation: true },
    { names: ['01-same.png', '02-same.png'], activation: true },
  ])
  let downloads = 0
  page.on('download', () => downloads++)
  await page.evaluate(() => {
    ;(window as unknown as { photoShareTest: { mode: string } }).photoShareTest.mode = 'cancel'
  })
  await saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }).click()
  await expect(
    saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }),
  ).toBeEnabled()
  await expect(saveDialog.getByRole('alert')).toHaveCount(0)
  expect(downloads).toBe(0)
  await page.evaluate(() => {
    ;(window as unknown as { photoShareTest: { mode: string } }).photoShareTest.mode = 'error'
  })
  await saveDialog.getByRole('button', { name: 'Сохранить это фото', exact: true }).click()
  await expect(saveDialog.getByRole('alert')).toContainText('Не удалось сохранить фотографии')
  await saveDialog.getByText('Скачать вместо системного меню', { exact: true }).click()
  const download = page.waitForEvent('download')
  await saveDialog.getByRole('button', { name: 'Скачать текущее файлом', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('02-same.png')
  await expect(saveDialog).toBeHidden()
  await expect(details.getByRole('button', { name: 'Сохранить фото', exact: true })).toBeFocused()
})
