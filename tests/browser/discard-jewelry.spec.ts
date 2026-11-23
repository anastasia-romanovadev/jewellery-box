import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

for (const theme of ['light', 'dark'] as const) {
  test(`discard modal preserves drafts, focus and guarded navigation, ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme })
    let nativeDialogs = 0
    page.on('dialog', async (dialog) => {
      nativeDialogs++
      await dialog.dismiss()
    })
    await page.goto('/#/collection')
    const add = page.getByRole('button', { name: 'Добавить украшение', exact: true })
    await add.tap()
    await page.getByRole('button', { name: 'Закрыть форму', exact: true }).tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await add.tap()
    await page.getByRole('textbox', { name: 'Заметки', exact: true }).fill('Мой черновик')
    await page.getByRole('button', { name: 'Закрыть форму', exact: true }).tap()
    const confirmation = page.getByRole('dialog', { name: 'Выйти без сохранения?', exact: true })
    await expect(confirmation).toContainText('Ты забыла нажать «Сохранить», точно выйти?')
    await expect(page.getByRole('button', { name: 'Остаться', exact: true })).toBeFocused()
    await expect(confirmation).toHaveCSS('opacity', '1')
    await page.screenshot({ path: `test-results/discard-jewelry-${theme}.png` })
    await page.getByRole('button', { name: 'Остаться', exact: true }).tap()
    await expect(confirmation).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Заметки', exact: true })).toHaveValue(
      'Мой черновик',
    )
    await expect(page.getByRole('button', { name: 'Закрыть форму', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(confirmation).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(confirmation).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Заметки', exact: true })).toHaveValue(
      'Мой черновик',
    )
    await page.getByRole('button', { name: 'Отмена', exact: true }).tap()
    await page.getByRole('button', { name: 'Выйти без сохранения', exact: true }).tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(add).toBeFocused()
    await add.tap()
    await expect(page.getByRole('textbox', { name: 'Заметки', exact: true })).toHaveValue('')
    await page.getByRole('textbox', { name: 'Заметки', exact: true }).fill('Переход')
    await page.evaluate(() => {
      location.hash = '#/analytics'
    })
    await expect(confirmation).toBeVisible()
    await expect(page).toHaveURL(/#\/collection$/)
    await page.getByRole('button', { name: 'Остаться', exact: true }).tap()
    await expect(page.getByRole('textbox', { name: 'Заметки', exact: true })).toHaveValue('Переход')
    await page.evaluate(() => {
      location.hash = '#/analytics'
    })
    await page.getByRole('button', { name: 'Выйти без сохранения', exact: true }).tap()
    await expect(page).toHaveURL(/#\/analytics$/)
    await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible()
    expect(nativeDialogs).toBe(0)
  })
}
