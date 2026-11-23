import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

for (const theme of ['light', 'dark'] as const) {
  test(`offline shell includes unopened lazy screens and preserves collection, ${theme}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      colorScheme: theme,
    })
    const page = await context.newPage()
    await page.goto('/')
    await expect(
      page.getByText('Приложение готово к работе без сети', { exact: true }),
    ).toBeVisible()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          }),
        )
    })
    const manifest = await page.request.get('/manifest.webmanifest')
    expect((await manifest.json()).display).toBe('standalone')
    await context.setOffline(true)
    await page.reload()
    await page.getByRole('button', { name: 'Добавить украшение', exact: true }).tap()
    await page.getByRole('textbox', { name: 'Материалы', exact: true }).focus()
    await page.keyboard.press('ArrowDown')
    await page.getByRole('option', { name: 'Белое золото', exact: true }).tap()
    await page
      .getByRole('combobox', { name: 'Проба — Белое золото', exact: true })
      .selectOption('fineness-gold-585')
    await page.getByRole('textbox', { name: 'Вес, г', exact: true }).fill('2,5')
    await page.getByLabel('Добавить фотографии из галереи').setInputFiles({
      name: 'offline.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
        'base64',
      ),
    })
    await expect(page.getByRole('heading', { name: 'Фотографии (1/5)' })).toBeVisible()
    await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).tap()
    await page.reload()
    await page.getByRole('button', { name: /^Открыть: Кольца/ }).tap()
    await expect(page.getByRole('dialog').locator('img')).toBeVisible()
    await page.getByRole('button', { name: 'Закрыть карточку', exact: true }).tap()
    await page.goto('/#/settings')
    await expect(
      page.getByRole('button', { name: 'Шаблон новой карточки', exact: true }),
    ).toBeVisible()
    await page.goto('/#/analytics')
    await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible()
    await context.close()
  })
}

test('a new worker waits for approval and other tabs to close before activation', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByText('Приложение готово к работе без сети', { exact: true })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const second = await context.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: 'Добавить украшение', exact: true }).click()
  await second.getByRole('textbox', { name: 'Заметки', exact: true }).fill('Несохранённый черновик')
  const workerPath = 'dist/sw.js'
  const original = await readFile(workerPath, 'utf8')
  try {
    await writeFile(workerPath, original + '\n// update workflow fixture ' + Date.now())
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update()
    })
    await expect(page.getByText('Доступна новая версия', { exact: true })).toBeVisible()
    await expect(second.getByRole('textbox', { name: 'Заметки', exact: true })).toHaveValue(
      'Несохранённый черновик',
    )
    await page.getByRole('button', { name: 'Обновить приложение', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('закрой другие вкладки')
    await expect(second.getByRole('textbox', { name: 'Заметки', exact: true })).toHaveValue(
      'Несохранённый черновик',
    )
    await second.close()
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Обновить приложение', exact: true }).click(),
    ])
    await expect(
      page.getByRole('button', { name: 'Добавить украшение', exact: true }),
    ).toBeVisible()
  } finally {
    await writeFile(workerPath, original)
    await second.close()
  }
})
