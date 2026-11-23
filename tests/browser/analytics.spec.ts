import { expect, test, type Page } from '@playwright/test'
import {
  buildCardSnapshot,
  DEFAULT_TEMPLATE,
  DEFAULT_DICTIONARIES,
} from '../../src/entities/template/model/template'
import type { JewelryItem } from '../../src/entities/jewelry/model/item'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

function item(
  id: string,
  typeId: string,
  materialIds: string[],
  weightGrams: number | undefined,
  materialFineness: Record<string, string>,
  noAssay = false,
): JewelryItem {
  const template = structuredClone(DEFAULT_TEMPLATE)
  template.fields = template.fields.map((field) => ({
    ...field,
    enabled:
      field.enabled &&
      field.id !== 'photos' &&
      !(field.id === 'weight' && weightGrams === undefined) &&
      !(field.id === 'fineness' && noAssay),
  }))
  return {
    id,
    typeId,
    materialIds,
    weightGrams,
    materialFineness,
    snapshot: buildCardSnapshot(template, DEFAULT_DICTIONARIES, typeId),
    revision: 1,
    stoneIds: [],
    photoIds: [],
    customValues: {},
    notes: '',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
  }
}
async function seed(page: Page) {
  await page.goto('/#/collection')
  await expect(
    page.getByText('Здесь пока пусто. Это явно недоразумение. Надо исправлять!'),
  ).toBeVisible()
  await page.evaluate(
    async (items) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('jewellery-box')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('items', 'readwrite')
          items.forEach((entry) => transaction.objectStore('items').put(entry))
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onabort = () => {
            db.close()
            reject(transaction.error)
          }
        }
      }),
    [
      item('gold-ring', 'ring', ['gold-white'], 10, { 'gold-white': 'fineness-gold-585' }),
      item('gold-pendant', 'pendant', ['gold-red'], 7, { 'gold-red': 'fineness-gold-750' }),
      item('silver', 'earrings', ['silver'], 20, { silver: 'fineness-silver-925' }),
      item('platinum', 'brooch', ['platinum'], 8, { platinum: 'fineness-platinum-950' }),
      item('mixed', 'ring', ['gold-white', 'silver'], 100, {
        'gold-white': 'fineness-gold-585',
        silver: 'fineness-silver-925',
      }),
      item('two-golds', 'ring', ['gold-white', 'gold-red'], 200, {
        'gold-white': 'fineness-gold-585',
        'gold-red': 'fineness-gold-750',
      }),
      item('no-weight', 'ring', ['gold-white'], undefined, { 'gold-white': 'fineness-gold-585' }),
      item('no-assay', 'ring', ['gold-white'], 2, {}, true),
    ],
  )
  await page.reload()
}
async function navigate(page: Page, name: string) {
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).tap()
  await page
    .getByRole('dialog', { name: 'Меню', exact: true })
    .getByRole('button', { name, exact: true })
    .tap()
}

for (const theme of ['light', 'dark'] as const) {
  test(`sidebar order, rotating facts and live analytics on touch screen, ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme })
    await seed(page)
    const messages: string[] = []
    for (let index = 0; index < 5; index++) {
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).tap()
      const menu = page.getByRole('dialog', { name: 'Меню', exact: true })
      messages.push(await menu.getByLabel('Факт о коллекции').innerText())
      await menu.getByRole('button', { name: 'Закрыть меню', exact: true }).tap()
    }
    expect(new Set(messages).size).toBe(5)
    expect(
      messages.some((message) => message.includes('Я отказываюсь комментировать это число.')),
    ).toBe(true)
    expect(
      messages.some((message) => message.includes('Маловато однако, ты точно всё записала?')),
    ).toBe(true)
    expect(messages.some((message) => message.includes('остальные точно не спрятались'))).toBe(true)
    await navigate(page, 'Коллекция')
    const menu = page.getByRole('dialog', { name: 'Меню', exact: true })
    await expect(
      menu.getByRole('navigation', { name: 'Категории коллекции' }).getByRole('button'),
    ).toHaveText(['Все', 'Кольца', 'Серьги', 'Цепи', 'Подвески', 'Браслеты', 'Броши', 'Прочее'])
    await menu.screenshot({ path: `test-results/sidebar-${theme}.png` })
    await menu.getByRole('button', { name: 'Аналитика', exact: true }).tap()
    await expect(page).toHaveURL(/#\/analytics$/)
    await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible()
    await expect(
      page.getByText('В твоей шкатулке находится 219 г украшений из золота.'),
    ).toBeVisible()
    await expect(page.getByText('Без указанного веса не учтено: 1.')).toBeVisible()
    await expect(page.getByText(/Таких украшений: 1/)).toBeVisible()
    await page.getByText('Посмотреть значения таблицей', { exact: true }).tap()
    await expect(page.getByRole('row', { name: '585 10', exact: true })).toBeVisible()
    await expect(page.getByRole('row', { name: '750 7', exact: true })).toBeVisible()
    await expect(page.getByRole('row', { name: 'Не указана 2', exact: true })).toBeVisible()
    await expect(page.getByRole('row', { name: 'Несколько проб 200', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'По типам', exact: true }).tap()
    await expect(page.getByRole('row', { name: 'Подвески 7', exact: true })).toBeVisible()
    await expect(page.getByRole('row', { name: 'Кольца 212', exact: true })).toBeVisible()
    await page.getByText('Посмотреть значения таблицей', { exact: true }).tap()
    await page.getByRole('button', { name: 'По пробам', exact: true }).tap()
    await page.getByRole('heading', { name: 'Аналитика', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/analytics-${theme}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Серебро', exact: true }).tap()
    await expect(
      page.getByText('В твоей шкатулке находится 20 г украшений из серебра.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Платина', exact: true }).tap()
    await expect(
      page.getByText('В твоей шкатулке находится 8 г украшений из платины.'),
    ).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible()
    await navigate(page, 'Коллекция')
    await page
      .getByRole('dialog', { name: 'Меню', exact: true })
      .getByRole('button', { name: 'Подвески', exact: true })
      .tap()
    await page.getByRole('button', { name: 'Открыть: Подвески, Красное золото', exact: true }).tap()
    await page.getByRole('button', { name: 'Редактировать', exact: true }).tap()
    await expect(
      page.getByRole('combobox', { name: 'Тип изделия', exact: true }).locator('option'),
    ).toHaveText(['Кольца', 'Серьги', 'Цепи', 'Подвески', 'Браслеты', 'Броши', 'Прочее'])
    await expect(page.getByLabel('Размер', { exact: true })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Вес, г', exact: true }).fill('9')
    await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await navigate(page, 'Аналитика')
    await expect(
      page.getByText('В твоей шкатулке находится 221 г украшений из золота.'),
    ).toBeVisible()
    await navigate(page, 'Коллекция')
    await page
      .getByRole('dialog', { name: 'Меню', exact: true })
      .getByRole('button', { name: 'Подвески', exact: true })
      .tap()
    await page.getByRole('button', { name: 'Открыть: Подвески, Красное золото', exact: true }).tap()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Удалить украшение', exact: true }).tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await navigate(page, 'Аналитика')
    await expect(
      page.getByText('В твоей шкатулке находится 212 г украшений из золота.'),
    ).toBeVisible()
  })
}

test('empty analytics route works directly and supports desktop keyboard navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/#/analytics')
  await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible()
  await expect(page.getByText(/Пока нет украшений только из золота/)).toBeVisible()
  await page.getByRole('button', { name: 'Платина', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Пока нет украшений только из платины/)).toBeVisible()
  await expect(page.getByRole('img', { name: /Вес по/ })).toHaveCount(0)
})

for (const theme of ['light', 'dark'] as const) {
  test(`prices persist and money charts follow grouping on narrow touch screen, ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.emulateMedia({ colorScheme: theme })
    await seed(page)
    await navigate(page, 'Аналитика')
    await page.getByRole('button', { name: 'Стоимость, ₽', exact: true }).tap()
    await expect(page.getByText(/Чтобы увидеть стоимость/)).toBeVisible()
    const input = page.getByRole('textbox', { name: 'Цена за грамм, ₽/г', exact: true })
    const save = page.getByRole('button', { name: 'Сохранить цену', exact: true })
    await input.fill('-1')
    await save.tap()
    await expect(page.getByRole('alert')).toContainText('Введи положительную цену')
    await input.fill('100,50')
    await save.tap()
    await expect(page.getByText('Цена сохранена.', { exact: true })).toBeVisible()
    await expect(
      page.getByText(/Общая стоимость всех твоих украшений из золота составляет/),
    ).toContainText('22 009,5 рублей')
    await page.getByText('Посмотреть значения таблицей', { exact: true }).tap()
    await expect(page.getByRole('row', { name: '585 1 005', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'По типам', exact: true }).tap()
    await expect(page.getByRole('row', { name: 'Кольца 21 306', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Серебро', exact: true }).tap()
    await expect(input).toHaveValue('')
    await input.fill('10')
    await save.tap()
    await expect(
      page.getByText(/Общая стоимость всех твоих украшений из серебра составляет/),
    ).toContainText('200 рублей')
    await page.getByRole('button', { name: 'Платина', exact: true }).tap()
    await input.fill('20')
    await save.tap()
    await expect(
      page.getByText(/Общая стоимость всех твоих украшений из платины составляет/),
    ).toContainText('160 рублей')
    await page.reload()
    await expect(input).toHaveValue('100,5')
    await page.getByRole('button', { name: 'Стоимость, ₽', exact: true }).tap()
    await expect(page.getByRole('img', { name: 'Стоимость по пробам', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/pricing-${theme}.png`, fullPage: true })
    for (const [metal, price] of [
      ['Серебро', '10'],
      ['Платина', '20'],
    ]) {
      await page.getByRole('button', { name: metal, exact: true }).tap()
      await expect(input).toHaveValue(price)
    }
    await input.fill('')
    await save.tap()
    await expect(page.getByText(/Чтобы увидеть стоимость/)).toBeVisible()
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`personal copy changes on visits but stays stable while browsing, ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.emulateMedia({ colorScheme: theme })
    await seed(page)
    const subtitle = page
      .locator('header')
      .filter({ has: page.getByRole('heading', { name: 'Личная шкатулка', exact: true }) })
      .locator('p')
    const seen: string[] = []
    for (let visit = 0; visit < 4; visit++) {
      seen.push(await subtitle.innerText())
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await navigate(page, 'Аналитика')
      await expect(page.getByText('Самая приятная вкладка во всём приложении')).toBeVisible()
      await expect(page.getByText('Я отказываюсь комментировать это число.')).not.toBeVisible()
      const leader = page.getByText(
        /Любимчиков видно сразу|Главные тяжеловесы|Аплодисменты, пожалуйста/,
      )
      const leaderText = await leader.innerText()
      await page.getByRole('button', { name: 'По типам', exact: true }).tap()
      await expect(leader).toHaveText(leaderText)
      await navigate(page, 'Коллекция')
      await page
        .getByRole('dialog', { name: 'Меню', exact: true })
        .getByRole('button', { name: 'Закрыть меню', exact: true })
        .tap()
    }
    expect(new Set(seen).size).toBe(4)
    await expect(subtitle).toHaveText(seen[0])
    await navigate(page, 'Аналитика')
    await page.getByRole('textbox', { name: 'Цена за грамм, ₽/г', exact: true }).fill('10000')
    await page.getByRole('button', { name: 'Сохранить цену', exact: true }).tap()
    await expect(page.getByText(/Считай, это ещё одна квартира в Сухом Логу/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/personal-copy-${theme}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Серебро', exact: true }).tap()
    await expect(page.getByText('Маловато однако, ты точно всё записала?')).not.toBeVisible()
    await expect(page.getByText(/Считай, это ещё одна квартира в Сухом Логу/)).toHaveCount(0)
  })
}
