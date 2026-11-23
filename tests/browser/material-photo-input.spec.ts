import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark'] as const) {
  test(`touch material selection never opens the photo chooser, ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 600 },
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
    })
    const page = await context.newPage()
    let fileChoosers = 0
    page.on('filechooser', async (chooser) => {
      fileChoosers++
      await chooser.setFiles([])
    })
    try {
      await page.goto('http://127.0.0.1:4173/#/collection')
      await page.getByRole('button', { name: 'Добавить украшение', exact: true }).tap()
      const materials = page
        .locator('.mantine-MultiSelect-root')
        .filter({ has: page.getByRole('textbox', { name: 'Материалы', exact: true }) })
      for (const name of ['Белое золото', 'Серебро', 'Платина']) {
        await materials.locator('.mantine-MultiSelect-input').tap({ position: { x: 5, y: 5 } })
        expect(fileChoosers).toBe(0)
        await page.getByRole('option', { name, exact: true }).tap()
        expect(fileChoosers).toBe(0)
        await expect(
          materials.locator('.mantine-Pill-label').filter({ hasText: name }),
        ).toBeVisible()
        await page.getByRole('textbox', { name: 'Вес, г', exact: true }).focus()
        expect(fileChoosers).toBe(0)
      }
      await materials.locator('label').tap()
      expect(fileChoosers).toBe(0)
      await page.getByRole('textbox', { name: 'Вес, г', exact: true }).focus()
      await expect(page.getByRole('heading', { name: 'Фотографии (0/5)' })).toBeVisible()
      const picker = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Из галереи', exact: true }).tap()
      expect((await picker).isMultiple()).toBe(true)
      expect(fileChoosers).toBe(1)
      const camera = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Снять фото', exact: true }).tap()
      expect((await camera).isMultiple()).toBe(false)
      expect(fileChoosers).toBe(2)
    } finally {
      await context.close()
    }
  })
}
