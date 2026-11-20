import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import type { JewelryItem } from '../../src/entities/jewelry/model/item'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
  'base64',
)
const photo = (name = 'original.png') => ({ name, mimeType: 'image/png', buffer: png })

test('100 items read metadata without loading all original photos', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openForm(page)
  await fillForm(page)
  await save(page)
  await page.evaluate(
    (base64) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('jewellery-box')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction(['items', 'photos'], 'readwrite')
          const items = tx.objectStore('items'),
            photos = tx.objectStore('photos')
          const request = items.getAll()
          request.onsuccess = () => {
            const original = request.result[0] as JewelryItem
            items.clear()
            photos.clear()
            // Reproducible synthetic I/O fixture: valid 1x1 PNG padded to 256 KiB.
            // This does not model decoding memory for real high-resolution iPhone photos.
            const bytes = new Uint8Array(256 * 1024)
            bytes.set(Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)))
            const blob = new Blob([bytes], { type: 'image/png' })
            for (let i = 0; i < 100; i++) {
              const id = 'benchmark-' + i,
                photoIds = [0, 1, 2].map((n) => id + '-photo-' + n)
              items.add({ ...original, id, photoIds })
              photoIds.forEach((photoId) =>
                photos.add({
                  id: photoId,
                  itemId: id,
                  blob,
                  originalName: 'fixture.png',
                  mimeType: blob.type,
                  byteSize: blob.size,
                  width: 1,
                  height: 1,
                }),
              )
            }
          }
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
    png.toString('base64'),
  )
  await page.addInitScript(() => {
    const metrics = { photoReads: 0 }
    Object.defineProperty(window, 'collectionMetrics', { value: metrics })
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'photos') metrics.photoReads++
      return get.apply(this, args)
    }
  })
  const started = Date.now()
  await page.reload()
  await expect(page.getByText('100 из 100', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' })).toHaveCount(100)
  await expect(page.locator('main img').first()).toBeVisible()
  const elapsedMs = Date.now() - started
  const metrics = await page.evaluate(
    () => (window as Window & { collectionMetrics: { photoReads: number } }).collectionMetrics,
  )
  expect(metrics.photoReads).toBeGreaterThan(0)
  expect(metrics.photoReads).toBeLessThan(20)
  const report = JSON.stringify(
    {
      items: 100,
      photos: 300,
      bytesPerPhoto: 262144,
      totalBytes: 78643200,
      viewport: '390x844',
      elapsedMs,
      ...metrics,
    },
    null,
    2,
  )
  const reportPath = info.outputPath('collection-benchmark.json')
  await writeFile(reportPath, report)
  await info.attach('collection-benchmark.json', {
    path: reportPath,
    contentType: 'application/json',
  })
})
async function openForm(page: Page) {
  await page.goto('/#/collection')
  await page.getByRole('button', { name: 'Добавить украшение', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Добавить украшение' })).toBeVisible()
}
async function fillForm(page: Page) {
  await page.getByRole('textbox', { name: 'Материалы' }).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('option', { name: 'Белое золото', exact: true }).click()
  await page.getByRole('combobox', { name: 'Проба', exact: true }).selectOption('fineness-585')
  await page.getByRole('textbox', { name: 'Вес, г', exact: true }).fill('3,25')
  await page.getByLabel('Размер', { exact: true }).fill('16,5')
  await page.getByLabel('Добавить фотографии из галереи').setInputFiles(photo())
  await expect(page.getByRole('heading', { name: 'Фотографии (1/5)' })).toBeVisible()
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' })).toBeVisible()
}

test('creates, reloads, changes size format, filters and deletes without orphan photos', async ({
  page,
}) => {
  await openForm(page)
  await fillForm(page)
  await save(page)
  await page.reload()
  await page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }).click()
  await expect(page.getByRole('dialog')).toContainText('16,5')
  await page.getByRole('button', { name: 'Открыть фотографию крупно' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Просмотр фотографии' }).locator('img'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть просмотр фото' }).click()
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click()
  await page.getByRole('combobox', { name: 'Тип изделия', exact: true }).selectOption('earrings')
  await expect(page.getByLabel('Размер', { exact: true })).toHaveValue('')
  await page.getByLabel('Размер', { exact: true }).selectOption('medium')
  await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Открыть: Серьги, Белое золото' })).toBeVisible()
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  await page.getByLabel('Формат размера').selectOption('ring')
  await page.getByRole('button', { name: 'Применить фильтры' }).click()
  await expect(
    page.getByText('По выбранным условиям украшений нет. Измените фильтры или категорию.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
  await page.getByRole('button', { name: 'Открыть: Серьги, Белое золото' }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Удалить украшение', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Удалить украшение', exact: true }).click()
  await expect(page.getByText('В шкатулке пока нет украшений. Добавьте первое.')).toBeVisible()
  const counts = await page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const request = indexedDB.open('jewellery-box')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(['items', 'photos'])
          const items = tx.objectStore('items').count(),
            photos = tx.objectStore('photos').count()
          tx.oncomplete = () => {
            resolve([items.result, photos.result])
            db.close()
          }
        }
      }),
  )
  expect(counts).toEqual([0, 0])
})

test('enforces photo limit, retains form on write failure and warns before discarding', async ({
  page,
}) => {
  await openForm(page)
  await fillForm(page)
  await page
    .getByLabel('Добавить фотографии из галереи')
    .setInputFiles(Array.from({ length: 5 }, (_, i) => photo(i + '.png')))
  await expect(page.getByRole('alert')).toContainText('не больше 5')
  await expect(page.getByRole('heading', { name: 'Фотографии (1/5)' })).toBeVisible()
  await page
    .getByLabel('Добавить фотографии из галереи')
    .setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') })
  await expect(page.getByRole('alert')).toContainText('Не удалось открыть')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'items') {
        IDBObjectStore.prototype.put = original
        throw new DOMException('Full', 'QuotaExceededError')
      }
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('хранилищу')
  await expect(page.getByRole('textbox', { name: 'Вес, г', exact: true })).toHaveValue('3,25')
  await save(page)
  await page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }).click()
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить фото 1' }).click()
  await page.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(page.getByText('Добавьте хотя бы одну фотографию')).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  await page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }).click()
  await expect(page.getByRole('dialog').locator('img')).toBeVisible()
})

test('preserves local edits when another tab saves a newer revision', async ({ page, context }) => {
  await openForm(page)
  await fillForm(page)
  await save(page)
  const second = await context.newPage()
  await second.goto('/#/collection')
  for (const tab of [page, second]) {
    await tab.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }).click()
    await tab.getByRole('button', { name: 'Редактировать', exact: true }).click()
  }
  await second.getByLabel('Заметки', { exact: true }).fill('Мой черновик')
  await page.getByLabel('Заметки', { exact: true }).fill('Новая версия')
  await save(page)
  await second.getByRole('button', { name: 'Сохранить украшение', exact: true }).click()
  await expect(second.getByRole('alert')).toContainText('другой вкладке')
  await expect(second.getByLabel('Заметки', { exact: true })).toHaveValue('Мой черновик')
  await second.close()
})

for (const theme of ['light', 'dark'] as const) {
  test('collection editor on narrow touch screen, ' + theme, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      colorScheme: theme,
    })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/#/collection')
    await page.getByRole('button', { name: 'Добавить украшение', exact: true }).tap()
    await fillForm(page)
    await page.screenshot({
      path: 'test-results/collection-editor-' + theme + '.png',
      fullPage: true,
    })
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      const overflow = await page.getByRole('dialog').evaluate((element) =>
        [...element.querySelectorAll('*')]
          .filter((child) => {
            const rect = child.getBoundingClientRect()
            return rect.width > 0 && rect.right > window.innerWidth + 1
          })
          .map((child) => ({
            tag: child.tagName,
            class: child.className,
            text: child.textContent?.slice(0, 60),
            width: child.getBoundingClientRect().width,
          })),
      )
      expect(
        await page
          .getByRole('dialog')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        JSON.stringify(overflow),
      ).toBe(true)
    }
    await context.close()
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(
    'mobile photos swipe in details and viewer without opening on a drag, ' + theme,
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        colorScheme: theme,
      })
      const page = await context.newPage()
      await openForm(page)
      await fillForm(page)
      await page.getByLabel('Добавить фотографии из галереи').setInputFiles(photo('second.png'))
      await expect(page.getByRole('heading', { name: 'Фотографии (2/5)' })).toBeVisible()
      await save(page)
      await page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }).click()
      const client = await context.newCDPSession(page)
      async function swipe(dx: number, dy = 0) {
        const image = page.getByRole('dialog').last().locator('img')
        await expect(image).toBeVisible()
        const box = await image.boundingBox()
        if (!box) throw new Error('Photo is not laid out')
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        })
        for (let step = 1; step <= 5; step++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + (dx * step) / 5, y: y + (dy * step) / 5 }],
          })
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      }
      const details = page.getByRole('dialog', { name: 'Кольца', exact: true })
      await swipe(-110)
      await expect(details.getByRole('status', { name: 'Номер фотографии' })).toHaveText('2 / 2')
      await expect(page.getByRole('dialog', { name: 'Просмотр фотографии' })).toHaveCount(0)
      await swipe(-110)
      await expect(details.getByRole('status', { name: 'Номер фотографии' })).toHaveText('2 / 2')
      await swipe(110)
      await expect(details.getByRole('status', { name: 'Номер фотографии' })).toHaveText('1 / 2')
      await swipe(5, -80)
      await expect(details.getByRole('status', { name: 'Номер фотографии' })).toHaveText('1 / 2')
      await details.getByRole('button', { name: 'Фото 2', exact: true }).click()
      await expect(details.getByRole('status', { name: 'Номер фотографии' })).toHaveText('2 / 2')
      await page.getByRole('button', { name: 'Открыть фотографию крупно' }).click()
      const viewer = page.getByRole('dialog', { name: 'Просмотр фотографии' })
      await swipe(110)
      await expect(viewer.getByRole('status', { name: 'Номер фотографии' })).toHaveText('1 / 2')
      await viewer
        .getByRole('button', { name: 'Фотография, используйте стрелки для переключения' })
        .focus()
      await page.keyboard.press('ArrowRight')
      await expect(viewer.getByRole('status', { name: 'Номер фотографии' })).toHaveText('2 / 2')
      await expect(
        page.getByRole('button', { name: /Предыдущее фото|Следующее фото/ }),
      ).toHaveCount(0)
      await page.screenshot({ path: 'test-results/photo-viewer-' + theme + '.png' })
      await context.close()
    },
  )
}

for (const theme of ['light', 'dark'] as const) {
  test(
    'filter modal applies drafts, shows selection and clears it, ' + theme,
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 320, height: 844 },
        hasTouch: true,
        colorScheme: theme,
      })
      const page = await context.newPage()
      await openForm(page)
      await fillForm(page)
      await save(page)
      await page.getByRole('button', { name: 'Фильтры', exact: true }).tap()
      const modal = page.getByRole('dialog', { name: 'Фильтры', exact: true })
      const min = modal.getByRole('textbox', { name: 'Вес от, г' })
      const max = modal.getByRole('textbox', { name: 'Вес до, г' })
      await min.fill('4')
      await max.fill('2')
      await expect(modal.getByRole('button', { name: 'Применить фильтры' })).toBeDisabled()
      await max.fill('5')
      const aligned = await modal.evaluate((element) => {
        const inputs = element.querySelectorAll('fieldset input')
        const first = inputs[0].getBoundingClientRect()
        const second = inputs[1].getBoundingClientRect()
        return Math.abs(first.y - second.y) < 1 && first.right < second.left
      })
      expect(aligned).toBe(true)
      await expect(
        page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }),
      ).toBeAttached()
      await modal.getByRole('button', { name: 'Закрыть фильтры' }).tap()
      await page.getByRole('button', { name: 'Фильтры', exact: true }).tap()
      await expect(min).toHaveValue('')
      await min.fill('4')
      await max.fill('5')
      await page.screenshot({ path: 'test-results/filter-modal-' + theme + '.png' })
      await modal.getByRole('button', { name: 'Применить фильтры' }).tap()
      await expect(modal).toBeHidden()
      await expect(page.getByText('Вес от 4 до 5 г', { exact: true })).toBeVisible()
      await expect(
        page.getByText('По выбранным условиям украшений нет. Измените фильтры или категорию.'),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Сбросить фильтры' }).tap()
      await expect(page.getByText('Вес от 4 до 5 г', { exact: true })).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Открыть: Кольца, Белое золото' }),
      ).toBeVisible()
      await context.close()
    },
  )
}
