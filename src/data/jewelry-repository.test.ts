/// <reference types="node" />
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { JewelleryDatabase } from './database'
import { getCatalog, saveDictionaryEntry, saveTemplate, ConflictError } from './catalog-repository'
import { saveItem, deleteItem, readItems, readPhoto } from './jewelry-repository'
import { buildCardSnapshot } from '../entities/template/model/template'
import {
  changeItemType,
  filterItems,
  EMPTY_FILTERS,
  itemValues,
  type JewelryDraft,
  type NewPhoto,
} from '../entities/jewelry/model/item'

let db: JewelleryDatabase
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  db = new JewelleryDatabase('items-test-' + crypto.randomUUID())
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
  vi.unstubAllGlobals()
})
function photo(): NewPhoto {
  const blob = new Blob(['original bytes'], { type: 'image/png' })
  return {
    id: crypto.randomUUID(),
    blob,
    byteSize: blob.size,
    mimeType: blob.type,
    originalName: 'original.png',
    width: 20,
    height: 30,
  }
}
async function draft(
  type = 'ring',
  photos = [photo()],
): Promise<{ draft: JewelryDraft; photos: NewPhoto[] }> {
  const catalog = await getCatalog(db)
  return {
    photos,
    draft: {
      id: crypto.randomUUID(),
      revision: 0,
      snapshot: buildCardSnapshot(catalog.template, catalog.entries, type),
      values: {
        typeId: type,
        materialIds: ['gold-white'],
        stoneIds: ['ruby'],
        fineness: 'fineness-585',
        weightGrams: '3,25',
        size: type === 'earrings' ? 'small' : type === 'brooch' ? undefined : '16,5',
        notes: '',
        photoIds: photos.map((photo) => photo.id),
        customValues: {},
      },
    },
  }
}
describe('jewelry transactions', () => {
  it('persists normalized values and unchanged photo bytes across reopen', async () => {
    const input = await draft()
    const item = await saveItem(input.draft, input.photos, db)
    db.close()
    await db.open()
    expect(await readItems(db)).toEqual([item])
    expect(item.weightGrams).toBe(3.25)
    expect(item.size).toBe(16.5)
    expect(await (await readPhoto(item.photoIds[0], db)).blob.text()).toBe('original bytes')
  })
  it('rolls back added/deleted photos when updating the item fails', async () => {
    const input = await draft()
    const item = await saveItem(input.draft, input.photos, db)
    const added = photo()
    vi.spyOn(db.items, 'put').mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'))
    await expect(
      saveItem(
        {
          id: item.id,
          revision: item.revision,
          snapshot: item.snapshot,
          values: { ...itemValues(item), photoIds: [added.id] },
        },
        [added],
        db,
      ),
    ).rejects.toThrow()
    expect(await readItems(db)).toEqual([item])
    expect(await db.photos.get(added.id)).toBeUndefined()
    expect(await db.photos.get(item.photoIds[0])).toBeDefined()
  })
  it('rejects sixth photo and missing required values without partial records', async () => {
    const input = await draft('ring', Array.from({ length: 6 }, photo))
    await expect(saveItem(input.draft, input.photos, db)).rejects.toThrow()
    expect(await db.items.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
    const second = await draft()
    second.draft.values.photoIds = []
    await expect(saveItem(second.draft, second.photos, db)).rejects.toThrow()
  })
  it('detects stale saves and deletes from another connection', async () => {
    const input = await draft()
    const first = await saveItem(input.draft, input.photos, db)
    const other = new JewelleryDatabase(db.name)
    try {
      const saved = await saveItem(
        {
          id: first.id,
          revision: first.revision,
          snapshot: first.snapshot,
          values: { ...itemValues(first), notes: 'new' },
        },
        [],
        other,
      )
      await expect(
        saveItem(
          {
            id: first.id,
            revision: first.revision,
            snapshot: first.snapshot,
            values: itemValues(first),
          },
          [],
          db,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
      await expect(deleteItem(first.id, first.revision, db)).rejects.toBeInstanceOf(ConflictError)
      expect(await readItems(db)).toEqual([saved])
    } finally {
      other.close()
    }
  })
  it('deletes item and photos atomically, with rollback on error', async () => {
    const input = await draft()
    const item = await saveItem(input.draft, input.photos, db)
    vi.spyOn(db.items, 'delete').mockRejectedValueOnce(new Error('Failed delete'))
    await expect(deleteItem(item.id, item.revision, db)).rejects.toThrow()
    expect(await db.photos.count()).toBe(1)
    expect(await db.items.count()).toBe(1)
    await deleteItem(item.id, item.revision, db)
    expect(await db.items.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
  })
  it('retains old fields and selected labels, but permits newly added choices', async () => {
    const catalog = await getCatalog(db)
    catalog.template.fields.push({
      id: 'extra',
      source: 'custom',
      kind: 'text',
      label: 'Гравировка',
      enabled: true,
      required: false,
      protected: false,
      scope: 'all',
      order: 8,
    })
    await saveTemplate(catalog.template, db)
    const input = await draft()
    input.draft.values.customValues.extra = 'АБ'
    const item = await saveItem(input.draft, input.photos, db)
    const current = await getCatalog(db)
    await saveTemplate(
      {
        ...current.template,
        fields: current.template.fields.filter((field) => field.id !== 'extra'),
      },
      db,
    )
    const material = current.entries.find((entry) => entry.id === 'gold-white')!
    await saveDictionaryEntry({ ...material, enabled: false }, db)
    await saveDictionaryEntry(
      { id: 'new-metal', kind: 'material', label: 'Титан', enabled: true, revision: 0 },
      db,
    )
    const saved = await saveItem(
      {
        id: item.id,
        revision: item.revision,
        snapshot: item.snapshot,
        values: { ...itemValues(item), materialIds: ['gold-white', 'new-metal'] },
      },
      [],
      db,
    )
    expect(saved.snapshot.fields.find((field) => field.id === 'extra')?.label).toBe('Гравировка')
    expect(saved.customValues.extra).toBe('АБ')
    expect(saved.snapshot.materials.find((option) => option.id === 'gold-white')?.label).toBe(
      'Белое золото',
    )
    expect(saved.snapshot.materials.find((option) => option.id === 'new-metal')?.label).toBe(
      'Титан',
    )
  })
  it('changes size format without changing other fields and clears incompatible values', async () => {
    const input = await draft()
    const item = await saveItem(input.draft, input.photos, db)
    const { entries } = await getCatalog(db)
    const earrings = changeItemType(
      item.snapshot,
      itemValues(item),
      entries.find((entry) => entry.id === 'earrings')!,
    )
    expect(earrings.values.size).toBeUndefined()
    expect(earrings.snapshot.fields.find((field) => field.id === 'size')?.options).toHaveLength(3)
    const saved = await saveItem({ id: item.id, revision: item.revision, ...earrings }, [], db)
    expect(saved.size).toBeUndefined()
    const brooch = changeItemType(
      saved.snapshot,
      itemValues(saved),
      entries.find((entry) => entry.id === 'brooch')!,
    )
    expect(brooch.snapshot.fields.some((field) => field.id === 'size')).toBe(false)
    const ring = changeItemType(
      brooch.snapshot,
      brooch.values,
      entries.find((entry) => entry.id === 'ring')!,
    )
    expect(ring.snapshot.fields.some((field) => field.id === 'size')).toBe(true)
    expect(item.size).toBe(16.5)
  })
  it('filters dimensions separately and combines groups with AND', async () => {
    const ring = await draft('ring'),
      chain = await draft('chain')
    const items = [
      await saveItem(ring.draft, ring.photos, db),
      await saveItem(chain.draft, chain.photos, db),
    ]
    expect(
      filterItems(items, 'all', {
        ...EMPTY_FILTERS,
        sizeKind: 'ring',
        sizeMin: '16',
        sizeMax: '17',
      }).map((item) => item.typeId),
    ).toEqual(['ring'])
    expect(
      filterItems(items, 'all', {
        ...EMPTY_FILTERS,
        materials: ['silver', 'gold-white'],
        stones: ['ruby'],
        weightMin: '3',
        weightMax: '4',
      }),
    ).toHaveLength(2)
    expect(filterItems(items, 'all', { ...EMPTY_FILTERS, stones: ['diamond'] })).toHaveLength(0)
  })
  it('migrates a hidden type in v2 without changing existing fields or reseeding deleted materials', async () => {
    const catalog = await getCatalog(db)
    await db.delete()
    const old = new Dexie(db.name)
    old.version(2).stores({ templates: 'id', dictionaries: 'id, kind', settings: 'id' })
    await old.table('templates').put({
      ...catalog.template,
      revision: 7,
      fields: catalog.template.fields.map((field) =>
        field.id === 'type' ? { ...field, enabled: false } : field,
      ),
    })
    await old
      .table('dictionaries')
      .bulkPut(
        catalog.entries
          .filter((entry) => entry.kind !== 'fineness')
          .map((entry) => (entry.id === 'silver' ? { ...entry, enabled: false } : entry)),
      )
    old.close()
    await db.open()
    const migrated = await getCatalog(db)
    expect(migrated.template.revision).toBe(8)
    expect(migrated.template.fields.find((field) => field.id === 'type')?.enabled).toBe(true)
    expect(migrated.entries.filter((entry) => entry.kind === 'fineness')).toHaveLength(16)
    expect(migrated.entries.find((entry) => entry.id === 'silver')?.enabled).toBe(false)
    db.close()
    await db.open()
    expect(await getCatalog(db)).toEqual(migrated)
  })
})
