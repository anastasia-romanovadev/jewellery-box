import { expect, test, type Page } from '@playwright/test'

type SectionTitle = 'Шаблон новой карточки' | 'Справочники'

test('dictionary editing and removal preserve keyboard focus', async ({ page }) => {
  await page.goto('/#/settings')
  await setSectionExpanded(page, 'Справочники', true)
  const edit = page.getByRole('button', { name: 'Изменить «Белое золото»', exact: true })
  await edit.click()
  const cancel = page.getByRole('button', { name: 'Отменить редактирование', exact: true })
  await cancel.focus()
  await page.keyboard.press('Enter')
  await expect(edit).toBeFocused()
  await page.keyboard.press('Enter')
  const save = page.getByRole('button', { name: 'Сохранить вариант', exact: true })
  await save.focus()
  await page.keyboard.press('Enter')
  await expect(edit).toBeFocused()

  const remove = page.getByRole('button', { name: 'Удалить «Белое золото»', exact: true })
  await remove.click()
  await page.keyboard.press('Escape')
  await expect(remove).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByLabel('Справочник', { exact: true })).toBeFocused()
  const creation = page.getByLabel('Название варианта', { exact: true })
  await creation.fill('Несохранённый материал')
  await page.getByRole('button', { name: 'Удалить «Красное золото»', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(creation).toBeFocused()
  await expect(creation).toHaveValue('Несохранённый материал')
})

async function setSectionExpanded(page: Page, title: SectionTitle, expanded: boolean) {
  const toggle = page.getByRole('button', { name: title, exact: true })
  await expect(toggle).toBeVisible()
  if ((await toggle.getAttribute('aria-expanded')) !== String(expanded)) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', String(expanded))
}

async function expectCollapsedSections(page: Page) {
  for (const title of ['Шаблон новой карточки', 'Справочники'] as const) {
    await expect(page.getByRole('button', { name: title, exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  }
  await expect(page.getByLabel('Название нового поля', { exact: true })).toBeHidden()
  await expect(page.getByLabel('Название варианта', { exact: true })).toBeHidden()
}

test('template and dictionaries survive reload; obsolete drafts cannot overwrite another tab', async ({
  page,
  context,
}) => {
  await page.goto('/#/settings')
  await expectCollapsedSections(page)
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await page.getByLabel('Название нового поля', { exact: true }).fill('Место покупки')
  await page.getByRole('button', { name: 'Добавить поле в шаблон', exact: true }).click()
  await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
  await expect(
    page.getByText('Шаблон сохранён. Изменения применятся к новым карточкам.', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expectCollapsedSections(page)
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await expect(page.getByLabel('Название поля «Место покупки»', { exact: true })).toHaveValue(
    'Место покупки',
  )

  const second = await context.newPage()
  await second.goto('/#/settings')
  await setSectionExpanded(second, 'Шаблон новой карточки', true)
  await second.getByLabel('Название поля «Место покупки»', { exact: true }).fill('Мой черновик')
  await page.getByLabel('Название поля «Место покупки»', { exact: true }).fill('Город покупки')
  await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
  await expect(
    page.getByText('Шаблон сохранён. Изменения применятся к новым карточкам.', { exact: true }),
  ).toBeVisible()
  await second.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
  await expect(second.getByText('Шаблон не сохранён', { exact: true })).toBeVisible()
  await expect(second.getByLabel('Название поля «Мой черновик»', { exact: true })).toHaveValue(
    'Мой черновик',
  )
  await second.close()
  const remove = page.getByRole('button', { name: 'Удалить поле «Город покупки»', exact: true })
  await expect(remove).toBeVisible()
  await remove.click()
  await expect(page.getByLabel('Название поля «Город покупки»', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
  await expect(remove).toBeVisible()
  await remove.click()
  await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Сохранить шаблон', exact: true })).toBeDisabled()
  await page.reload()
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await expect(page.getByLabel('Название поля «Город покупки»', { exact: true })).toHaveCount(0)

  await setSectionExpanded(page, 'Справочники', true)
  await page.getByLabel('Справочник', { exact: true }).selectOption('material')
  await page.getByLabel('Название варианта', { exact: true }).fill('Тестовый материал')
  await page.getByRole('button', { name: 'Добавить вариант', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Изменить «Тестовый материал»' })).toBeVisible()
  await page.reload()
  await expectCollapsedSections(page)
  await setSectionExpanded(page, 'Справочники', true)
  await page.getByRole('button', { name: 'Изменить «Тестовый материал»' }).click()
  await page
    .getByLabel('Название варианта «Тестовый материал»', { exact: true })
    .fill('Обновлённый материал')
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить «Обновлённый материал»' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Подтвердить удаление', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Изменить «Обновлённый материал»' })).toHaveCount(0)
  await page.reload()
  await expectCollapsedSections(page)
  await setSectionExpanded(page, 'Справочники', true)
  await expect(page.getByRole('button', { name: 'Изменить «Обновлённый материал»' })).toHaveCount(0)
})

test('sections toggle by keyboard and retain unsaved template and dictionary drafts', async ({
  page,
}) => {
  await page.goto('/#/settings')
  await expectCollapsedSections(page)
  const templateToggle = page.getByRole('button', { name: 'Шаблон новой карточки', exact: true })
  await templateToggle.focus()
  await page.keyboard.press('Enter')
  await expect(templateToggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByLabel('Название нового поля', { exact: true }).fill('Несохранённое поле')
  await page.getByRole('button', { name: 'Добавить поле в шаблон', exact: true }).click()
  await templateToggle.focus()
  await page.keyboard.press('Space')
  await expect(templateToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Название поля «Несохранённое поле»', { exact: true })).toBeHidden()
  await expect(templateToggle).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Название поля «Несохранённое поле»', { exact: true })).toHaveValue(
    'Несохранённое поле',
  )
  await expect(page.getByRole('button', { name: 'Сохранить шаблон', exact: true })).toBeEnabled()

  const dictionaryToggle = page.getByRole('button', { name: 'Справочники', exact: true })
  await dictionaryToggle.focus()
  await page.keyboard.press('Space')
  await expect(dictionaryToggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByLabel('Название варианта', { exact: true }).fill('Несохранённый материал')
  await dictionaryToggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Название варианта', { exact: true })).toBeHidden()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Название варианта', { exact: true })).toHaveValue(
    'Несохранённый материал',
  )
  // Collapsing retains drafts in this session but does not silently save them.
  await page.reload()
  await expectCollapsedSections(page)
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await expect(page.getByLabel('Название поля «Несохранённое поле»', { exact: true })).toHaveCount(
    0,
  )
  await setSectionExpanded(page, 'Справочники', true)
  await expect(page.getByLabel('Название варианта', { exact: true })).toHaveValue('')
})

test('field visibility survives saving and reload and can be enabled again', async ({ page }) => {
  await page.goto('/#/settings')
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  const fineness = page.getByRole('checkbox', { name: 'Показывать поле «Проба»', exact: true })
  await expect(fineness).toBeChecked()
  await fineness.uncheck()
  await setSectionExpanded(page, 'Шаблон новой карточки', false)
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await expect(fineness).not.toBeChecked()
  await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
  await expect(
    page.getByText('Шаблон сохранён. Изменения применятся к новым карточкам.', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expectCollapsedSections(page)
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await expect(fineness).not.toBeChecked()
  await fineness.check()
  await page.getByRole('button', { name: 'Сохранить шаблон', exact: true }).click()
  await expect(
    page.getByText('Шаблон сохранён. Изменения применятся к новым карточкам.', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await setSectionExpanded(page, 'Шаблон новой карточки', true)
  await expect(fineness).toBeChecked()
})

for (const width of [320, 390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`settings layout ${width}px ${theme}, all accents and 200% text`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 1000,
        colorScheme: theme,
      })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('http://127.0.0.1:4173/#/settings')
      await expectCollapsedSections(page)
      if (width < 1000) {
        for (const title of ['Шаблон новой карточки', 'Справочники'] as const) {
          const toggle = page.getByRole('button', { name: title, exact: true })
          await toggle.locator('span', { hasText: title }).tap()
          await expect(toggle).toHaveAttribute('aria-expanded', 'true')
          await toggle.locator('svg').tap()
          await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        }
      }
      await setSectionExpanded(page, 'Справочники', true)
      await page.getByRole('button', { name: 'Изменить «Белое золото»', exact: true }).click()
      await expect(
        page.getByLabel('Название варианта «Белое золото»', { exact: true }),
      ).toBeFocused()
      await expect(page.getByRole('button', { name: 'Зелёный', exact: true })).toBeEnabled()
      for (const accent of ['Бордовый', 'Зелёный', 'Охра', 'Синий']) {
        const button = page.getByRole('button', { name: accent, exact: true })
        await button.click()
        await expect(button).toBeEnabled()
        for (const size of ['100%', '200%']) {
          await page.evaluate((value) => {
            document.documentElement.style.fontSize = value
          }, size)
          for (const expanded of [false, true]) {
            await setSectionExpanded(page, 'Шаблон новой карточки', expanded)
            await setSectionExpanded(page, 'Справочники', expanded)
            const overflow = await page.evaluate(() =>
              [...document.querySelectorAll('main *')]
                .filter((element) => {
                  const rect = element.getBoundingClientRect()
                  return rect.width > 0 && rect.right > window.innerWidth + 1
                })
                .map((element) => ({
                  tag: element.tagName,
                  class: element.className,
                  right: element.getBoundingClientRect().right,
                  text: element.textContent?.slice(0, 55),
                })),
            )
            expect(overflow, `overflow at ${size}, sections expanded=${expanded}`).toEqual([])
            if (expanded) {
              await expect(page.getByLabel('Название нового поля', { exact: true })).toBeVisible()
              await expect(page.getByLabel('Название варианта', { exact: true })).toBeVisible()
            } else {
              await expect(page.getByLabel('Название нового поля', { exact: true })).toBeHidden()
              await expect(page.getByLabel('Название варианта', { exact: true })).toBeHidden()
            }
          }
        }
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '100%'
      })
      if (width < 1000) {
        const menu = page.getByRole('button', { name: 'Открыть меню' })
        await menu.tap()
        await expect(page.getByRole('dialog', { name: 'Меню' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Закрыть меню', exact: true })).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(menu).toBeFocused()
      }
      await page.screenshot({ path: `test-results/settings-${width}-${theme}.png`, fullPage: true })
      expect(errors).toEqual([])
      await context.close()
    })
  }
}
