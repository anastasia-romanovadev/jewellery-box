import { expect, test } from '@playwright/test'

for (const width of [390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    test(`collection categories expand beneath collection, ${width}px ${theme}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 920,
        colorScheme: theme,
      })
      const page = await context.newPage()
      await page.goto('http://127.0.0.1:4173/#/settings')
      const mobile = width < 920
      const menu = page.getByRole('button', { name: 'Открыть меню' })
      if (mobile) await menu.tap()
      const collection = page.getByRole('button', { name: 'Коллекция', exact: true })
      const categories = page.getByRole('navigation', { name: 'Категории коллекции' })
      await expect(collection).toHaveAttribute('aria-expanded', 'false')
      await expect(categories).toBeHidden()
      if (mobile) await collection.tap()
      else {
        await collection.focus()
        await page.keyboard.press('Enter')
      }
      await expect(collection).toHaveAttribute('aria-expanded', 'true')
      await expect(categories).toBeVisible()
      if (mobile) await expect(page.getByRole('dialog', { name: 'Меню' })).toBeVisible()
      const collectionBox = await collection.boundingBox()
      const categoriesBox = await categories.boundingBox()
      const settingsBox = await page
        .getByRole('button', { name: 'Настройки', exact: true })
        .boundingBox()
      expect(categoriesBox!.y).toBeGreaterThanOrEqual(collectionBox!.y + collectionBox!.height)
      expect(settingsBox!.y).toBeGreaterThanOrEqual(categoriesBox!.y + categoriesBox!.height)
      await collection.click()
      await expect(categories).toBeHidden()
      await collection.click()
      await page.getByRole('button', { name: 'Серьги', exact: true }).click()
      await expect(
        page.getByText('Здесь пока пусто. Это явно недоразумение. Надо исправлять!', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByText('Кольцо «Роза»', { exact: true })).toHaveCount(0)
      if (mobile) {
        await expect(menu).toHaveAttribute('aria-expanded', 'false')
        await menu.tap()
      }
      await page.getByRole('button', { name: 'Настройки', exact: true }).click()
      if (mobile) await menu.tap()
      await expect(categories).toBeHidden()
      await expect(collection).toHaveAttribute('aria-expanded', 'false')
      await context.close()
    })
  }
