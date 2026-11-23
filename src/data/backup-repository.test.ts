import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { JewelleryDatabase } from './database'
import { BACKUP_LIMITS, exportBackup, inspectBackup, restoreBackup } from './backup-repository'
import {
  getCatalog,
  readDataGeneration,
  saveTemplate,
  saveDictionaryEntry,
} from './catalog-repository'
import { saveMetalPrice } from './metal-price-repository'
import { saveItem, readPhoto } from './jewelry-repository'
import { buildCardSnapshot } from '../entities/template/model/template'
import { itemValues } from '../entities/jewelry/model/item'
let db: JewelleryDatabase
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
  db = new JewelleryDatabase('backup-test-' + crypto.randomUUID())
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
  vi.unstubAllGlobals()
})
async function seed() {
  const catalog = await getCatalog(db)
  const blob = new Blob(['original bytes'], { type: 'image/png' })
  const item = await saveItem(
    {
      id: 'item',
      revision: 0,
      snapshot: buildCardSnapshot(catalog.template, catalog.entries, 'ring'),
      values: {
        typeId: 'ring',
        materialIds: ['gold-white'],
        stoneIds: ['ruby'],
        materialFineness: { 'gold-white': 'fineness-gold-585' },
        weightGrams: 3,
        photoIds: ['photo'],
        customValues: {},
        notes: 'Сохранить',
      },
    },
    [
      {
        id: 'photo',
        blob,
        byteSize: blob.size,
        mimeType: blob.type,
        originalName: 'original.png',
        width: 20,
        height: 30,
      },
    ],
    db,
  )
  await db.metalPrices.put({ id: 'gold', pricePerGram: 6000, revision: 1 })
  return { catalog, item }
}
it('round trips original bytes, historical definitions, settings and prices, replacing absent rows', async () => {
  const { item } = await seed()
  const backup = await inspectBackup(await exportBackup(db))
  expect(backup.summary).toMatchObject({ items: 1, photos: 1 })
  await db.items.put({
    ...item,
    id: 'extra',
    photoIds: [],
    snapshot: {
      ...item.snapshot,
      fields: item.snapshot.fields.filter((field) => field.id !== 'photos'),
    },
  })
  await db.settings.update('appearance', { accentTone: 'blue' })
  await restoreBackup(backup, db)
  expect(await db.items.count()).toBe(1)
  expect((await db.items.get('item'))?.snapshot).toEqual(item.snapshot)
  expect(await (await readPhoto('photo', db)).blob.text()).toBe('original bytes')
  expect((await db.metalPrices.get('gold'))?.pricePerGram).toBe(6000)
  expect((await db.settings.get('appearance'))?.accentTone).toBe(
    backup.manifest.settings.accentTone,
  )
  expect(await readDataGeneration(db)).toBe(1)
})
it('rejects unknown versions, missing and changed photos and truncated archives before writing', async () => {
  const { item } = await seed()
  const original = new Uint8Array(await (await exportBackup(db)).arrayBuffer())
  for (const kind of ['version', 'missing', 'changed', 'truncated']) {
    const files = unzipSync(original)
    if (kind === 'version') {
      const manifest: { version: number } = JSON.parse(strFromU8(files['manifest.json']))
      manifest.version = 99
      files['manifest.json'] = strToU8(JSON.stringify(manifest))
    }
    if (kind === 'missing') delete files['photos/0.bin']
    if (kind === 'changed') files['photos/0.bin'][0] ^= 1
    const bytes =
      kind === 'truncated'
        ? original.subarray(0, original.length - 22)
        : zipSync(files, { level: 0 })
    await expect(inspectBackup(new Blob([new Uint8Array(bytes)]))).rejects.toThrow()
    expect(await db.items.get('item')).toEqual(item)
  }
})
it('rolls back every table and generation on quota failure', async () => {
  await seed()
  const backup = await inspectBackup(await exportBackup(db))
  await db.items.update('item', { notes: 'До восстановления' })
  vi.spyOn(db.photos, 'bulkPut').mockRejectedValueOnce(
    new DOMException('Full', 'QuotaExceededError'),
  )
  await expect(restoreBackup(backup, db)).rejects.toThrow()
  expect((await db.items.get('item'))?.notes).toBe('До восстановления')
  expect(await readDataGeneration(db)).toBe(0)
  expect(await db.photos.count()).toBe(1)
})
it('rejects valid JSON whose ZIP checksum was corrupted', async () => {
  await seed()
  const bytes = new Uint8Array(await (await exportBackup(db)).arrayBuffer())
  const needle = strToU8('"weightGrams":3')
  const offset = bytes.findIndex((_, index) => needle.every((byte, n) => bytes[index + n] === byte))
  expect(offset).toBeGreaterThan(0)
  bytes[offset + needle.length - 1] = '4'.charCodeAt(0)
  await expect(inspectBackup(new Blob([bytes]))).rejects.toThrow()
  expect((await db.items.get('item'))?.weightGrams).toBe(3)
})
it('rejects saved and new forms opened before replacement, even with identical imported revisions', async () => {
  const { catalog, item } = await seed()
  await restoreBackup(await inspectBackup(await exportBackup(db)), db)
  await expect(
    saveItem(
      { id: item.id, revision: item.revision, snapshot: item.snapshot, values: itemValues(item) },
      [],
      db,
      0,
    ),
  ).rejects.toThrow()
  await expect(
    saveItem(
      { id: 'new-draft', revision: 0, snapshot: item.snapshot, values: itemValues(item) },
      [],
      db,
      0,
    ),
  ).rejects.toThrow()
  await expect(saveTemplate(catalog.template, db)).rejects.toThrow()
  await expect(
    saveDictionaryEntry(
      { id: 'new-stone', label: 'Новый камень', kind: 'stone', enabled: true, revision: 0 },
      db,
      0,
    ),
  ).rejects.toThrow()
  await expect(
    saveMetalPrice({ id: 'silver', pricePerGram: 100, revision: 0 }, db, 0),
  ).rejects.toThrow()
  expect(await db.dictionaries.get('new-stone')).toBeUndefined()
  expect(await db.metalPrices.get('silver')).toBeUndefined()
})

it('round trips an empty collection and restores despite an unavailable theme cache', async () => {
  await getCatalog(db)
  const backup = await inspectBackup(await exportBackup(db))
  expect(backup.summary).toMatchObject({ items: 0, photos: 0, totalBytes: 0 })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Cache unavailable')
  })
  await restoreBackup(backup, db)
  expect(await db.items.count()).toBe(0)
  expect(await db.photos.count()).toBe(0)
  expect(await db.templates.get('creation')).toMatchObject({
    fields: backup.manifest.template.fields,
  })
})

it('rejects duplicate IDs and unexpected archive paths or unused photo files', async () => {
  await seed()
  const original = new Uint8Array(await (await exportBackup(db)).arrayBuffer())
  for (const kind of ['duplicate', 'path', 'extra']) {
    const files = unzipSync(original)
    if (kind === 'duplicate') {
      const manifest: { items: unknown[] } = JSON.parse(strFromU8(files['manifest.json']))
      manifest.items.push(manifest.items[0])
      files['manifest.json'] = strToU8(JSON.stringify(manifest))
    } else files[kind === 'path' ? '../outside.bin' : 'photos/999.bin'] = new Uint8Array([1])
    await expect(
      inspectBackup(new Blob([new Uint8Array(zipSync(files, { level: 0 }))])),
    ).rejects.toThrow()
  }
  expect(await db.items.count()).toBe(1)
})

it('rejects excessive archive and manifest size before restoring anything', async () => {
  const oversized = new Blob(['placeholder'])
  Object.defineProperty(oversized, 'size', { value: BACKUP_LIMITS.archiveBytes + 1 })
  await expect(inspectBackup(oversized)).rejects.toThrow('256')
  const bytes = zipSync(
    { 'manifest.json': new Uint8Array(BACKUP_LIMITS.manifestBytes + 1) },
    { level: 0 },
  )
  await expect(inspectBackup(new Blob([new Uint8Array(bytes)]))).rejects.toThrow()
  expect(await db.items.count()).toBe(0)
})

it('exports one consistent snapshot while records and photo bytes change during archive creation', async () => {
  await seed()
  const original = Blob.prototype.arrayBuffer
  vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementationOnce(async function (this: Blob) {
    await db.transaction('rw', db.items, db.photos, async () => {
      await db.items.update('item', { notes: 'Новая редакция' })
      const blob = new Blob(['replacement'], { type: 'image/png' })
      await db.photos.update('photo', { blob, byteSize: blob.size })
    })
    return original.call(this)
  })
  const backup = await inspectBackup(await exportBackup(db))
  expect(backup.manifest.items[0].notes).toBe('Сохранить')
  expect(await backup.photos[0].blob.text()).toBe('original bytes')
  expect((await db.items.get('item'))?.notes).toBe('Новая редакция')
})
