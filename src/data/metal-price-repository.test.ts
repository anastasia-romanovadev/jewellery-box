import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { JewelleryDatabase } from './database'
import { readMetalPrices, saveMetalPrice } from './metal-price-repository'
import { parsePriceInput } from '../entities/jewelry/model/pricing'
import { ConflictError, initializeDatabase } from './catalog-repository'

let db: JewelleryDatabase
beforeEach(() => {
  db = new JewelleryDatabase('pricing-tests')
})
afterEach(async () => {
  await db.delete()
})

it('persists independent prices, rejects stale writes and supports clearing', async () => {
  await initializeDatabase(db)
  await saveMetalPrice({ id: 'gold', pricePerGram: 6500.25, revision: 0 }, db)
  await saveMetalPrice({ id: 'silver', pricePerGram: 100, revision: 0 }, db)
  db.close()
  await db.open()
  expect(await readMetalPrices(db)).toEqual([
    { id: 'gold', pricePerGram: 6500.25, revision: 1 },
    { id: 'silver', pricePerGram: 100, revision: 1 },
  ])
  await expect(
    saveMetalPrice({ id: 'gold', pricePerGram: 1, revision: 0 }, db),
  ).rejects.toBeInstanceOf(ConflictError)
  await saveMetalPrice({ id: 'gold', pricePerGram: null, revision: 1 }, db)
  expect((await readMetalPrices(db))[0].pricePerGram).toBeNull()
})

it('upgrades v6 without changing existing data', async () => {
  const old = new Dexie(db.name)
  old.version(6).stores({
    templates: 'id',
    dictionaries: 'id, kind',
    settings: 'id',
    items: 'id, typeId, createdAt',
    photos: 'id, itemId',
  })
  await old.table('items').put({ id: 'preserved', notes: 'keep' })
  await old.table('photos').put({ id: 'photo', itemId: 'preserved', bytes: new Uint8Array([1, 2]) })
  old.close()
  expect(await readMetalPrices(db)).toEqual([])
  expect(await db.items.get('preserved')).toEqual({ id: 'preserved', notes: 'keep' })
  const photo = await db
    .table<{ id: string; itemId: string; bytes: Uint8Array }>('photos')
    .get('photo')
  expect(photo?.itemId).toBe('preserved')
  expect(Array.from(photo!.bytes)).toEqual([1, 2])
})

it('validates input and stored records', async () => {
  expect(parsePriceInput(' 6500,25 ')).toBe(6500.25)
  expect(parsePriceInput('')).toBeNull()
  for (const value of ['-1', '0', 'Infinity', '1e5', '1.001', '1000000001'])
    expect(() => parsePriceInput(value)).toThrow()
  await expect(saveMetalPrice({ id: 'gold', pricePerGram: NaN, revision: 0 }, db)).rejects.toThrow()
  await db.metalPrices.put({ id: 'gold', pricePerGram: -1, revision: 1 })
  await expect(readMetalPrices(db)).rejects.toThrow()
})
