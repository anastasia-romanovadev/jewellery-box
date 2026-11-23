import { expect, test } from '@playwright/test'

test('settings, independent fineness groups and stone colors survive a browser restart', async ({
  playwright,
}, info) => {
  test.setTimeout(120_000)
  const profile = info.outputPath('browser-profile')
  const launch = () =>
    playwright.chromium.launchPersistentContext(profile, {
      channel: 'chrome',
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    })
  let context = await launch()
  try {
    let page = context.pages()[0]
    await page.goto('http://127.0.0.1:4173/#/settings')
    await expect(page.getByText('Проверка оформления', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Синий', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Синий', exact: true })).toBeEnabled()
    await page.getByRole('radio', { name: 'Тёмная', exact: true }).check()
    await expect(page.getByRole('radio', { name: 'Тёмная', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Шаблон новой карточки', exact: true }).click()
    await page.getByLabel('Название нового поля', { exact: true }).fill('Место покупки')
    await page.getByRole('button', { name: 'Добавить поле в шаблон', exact: true }).click()
    await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
    await expect(
      page.getByText('Шаблон сохранён. Изменения применятся к новым карточкам.', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Шаблон новой карточки', exact: true }).click()
    await page.getByRole('button', { name: 'Справочники', exact: true }).click()
    await page.getByLabel('Справочник', { exact: true }).selectOption('fineness')
    for (const metal of ['gold', 'silver']) {
      await page.getByLabel('Металл пробы', { exact: true }).selectOption(metal)
      await page.getByLabel('Название варианта', { exact: true }).fill('700')
      await page.getByRole('button', { name: 'Добавить вариант', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Изменить «700»', exact: true })).toBeVisible()
    }
    await page.getByLabel('Металл пробы', { exact: true }).selectOption('gold')
    await page.getByRole('button', { name: 'Удалить «700»', exact: true }).click()
    await page.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByLabel('Справочник', { exact: true }).selectOption('stone')
    await expect(page.getByRole('button', { name: 'Изменить «Топаз»', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Изменить «Аметист»', exact: true }).click()
    await page.getByLabel('Цвет камня', { exact: true }).fill('#664488')
    await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Изменить «Аметист»', exact: true }),
    ).toBeVisible()
    await page.getByLabel('Название варианта', { exact: true }).fill('Лунный камень')
    await page.getByLabel('Цвет нового камня', { exact: true }).fill('#aaccee')
    await page.getByRole('button', { name: 'Добавить вариант', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Изменить «Лунный камень»', exact: true }),
    ).toBeVisible()
    await context.close()

    context = await launch()
    page = context.pages()[0]
    await page.goto('http://127.0.0.1:4173/#/settings')
    await expect(page.getByRole('button', { name: 'Синий', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('radio', { name: 'Тёмная', exact: true })).toBeChecked()
    await expect(page.locator('html')).toHaveCSS('--accent', '#486581')
    await page.getByRole('button', { name: 'Шаблон новой карточки', exact: true }).click()
    await expect(page.getByLabel('Название поля «Место покупки»', { exact: true })).toHaveValue(
      'Место покупки',
    )
    await page.getByRole('button', { name: 'Шаблон новой карточки', exact: true }).click()
    await page.getByRole('button', { name: 'Справочники', exact: true }).click()
    await page.getByLabel('Справочник', { exact: true }).selectOption('fineness')
    await expect(page.getByRole('button', { name: 'Изменить «700»', exact: true })).toHaveCount(0)
    await page.getByLabel('Металл пробы', { exact: true }).selectOption('silver')
    await expect(page.getByRole('button', { name: 'Изменить «700»', exact: true })).toBeVisible()
    await page.getByLabel('Справочник', { exact: true }).selectOption('stone')
    const stoneRow = page
      .locator('li')
      .filter({ has: page.getByRole('button', { name: 'Изменить «Аметист»', exact: true }) })
    await expect(stoneRow.locator('svg')).toHaveCSS('--stone-color', '#664488')
    const addedRow = page
      .locator('li')
      .filter({ has: page.getByRole('button', { name: 'Изменить «Лунный камень»', exact: true }) })
    await expect(addedRow.locator('svg')).toHaveCSS('--stone-color', '#aaccee')
    for (const theme of ['Тёмная', 'Светлая']) {
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await expect(page.getByRole('radio', { name: theme, exact: true })).toBeEnabled()
      await page.setViewportSize({ width: 320, height: 844 })
      await stoneRow.scrollIntoViewIfNeeded()
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320)
      await page.screenshot({
        path: info.outputPath(`stones-${theme === 'Тёмная' ? 'dark' : 'light'}.png`),
      })
    }
    await page.getByRole('button', { name: 'Справочники', exact: true }).click()
    await page
      .getByRole('heading', { name: 'iPhone — Safari', exact: true })
      .scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('install-guide.png') })
  } finally {
    await context.close()
  }
})
