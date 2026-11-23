import Dexie from 'dexie'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JewelleryDatabase } from './database'
import {
  getAppearance,
  getCatalog,
  saveAppearance,
  saveDictionaryEntry,
} from './catalog-repository'
import { readItems, readPhoto, saveItem } from './jewelry-repository'
import {
  DEFAULT_DICTIONARIES,
  DEFAULT_TEMPLATE,
  FINENESS_LABELS,
} from '../entities/template/model/defaults'
import { buildCardSnapshot, type DictionaryEntry } from '../entities/template/model/template'
import { itemValues } from '../entities/jewelry/model/item'

const db = new JewelleryDatabase('settings-upgrade-tests')
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
})
afterEach(async () => {
  await db.delete()
  vi.unstubAllGlobals()
})

describe('settings persistence and migration', () => {
  it('keeps equal fineness numbers independent across metals and persists blue/color after reopen', async () => {
    const { entries } = await getCatalog(db)
    expect(
      entries
        .filter((entry) => entry.kind === 'fineness' && entry.metal === 'gold')
        .map((entry) => entry.label)
        .sort(),
    ).toEqual(['375', '500', '585', '750', '958', '999'])
    expect(
      entries
        .filter((entry) => entry.kind === 'fineness' && entry.metal === 'silver')
        .map((entry) => entry.label)
        .sort(),
    ).toEqual(['800', '830', '875', '925', '960', '999'])
    expect(
      entries
        .filter((entry) => entry.kind === 'fineness' && entry.metal === 'platinum')
        .map((entry) => entry.label)
        .sort(),
    ).toEqual(['585', '850', '900', '950', '999'])
    for (const metal of ['gold', 'silver'] as const)
      await saveDictionaryEntry(
        {
          id: `custom-${metal}`,
          kind: 'fineness',
          metal,
          label: '700',
          enabled: true,
          revision: 0,
        },
        db,
      )
    await expect(
      saveDictionaryEntry(
        {
          id: 'duplicate',
          kind: 'fineness',
          metal: 'gold',
          label: '700',
          enabled: true,
          revision: 0,
        },
        db,
      ),
    ).rejects.toThrow('название')
    const gold = entries.find((entry) => entry.id === 'fineness-gold-999')!
    await saveDictionaryEntry({ ...gold, enabled: false }, db)
    const amethyst = entries.find((entry) => entry.id === 'amethyst')!
    await saveDictionaryEntry({ ...amethyst, color: '#664488' }, db)
    await expect(saveDictionaryEntry({ ...amethyst, color: 'not-a-color' }, db)).rejects.toThrow()
    const appearance = await getAppearance(db)
    await saveAppearance({ themeMode: 'dark', accentTone: 'blue' }, appearance.revision, db)
    db.close()
    await db.open()
    const restored = await getCatalog(db)
    expect(await getAppearance(db)).toMatchObject({ themeMode: 'dark', accentTone: 'blue' })
    expect(restored.entries.find((entry) => entry.id === 'amethyst')?.color).toBe('#664488')
    expect(restored.entries.find((entry) => entry.id === gold.id)?.enabled).toBe(false)
    expect(restored.entries.find((entry) => entry.id === 'fineness-platinum-999')?.enabled).toBe(
      true,
    )
    expect(restored.entries.filter((entry) => entry.label === '700')).toHaveLength(2)
  })

  it('upgrades v3 without changing old cards, photos, custom values or deleted entries', async () => {
    const legacy = new Dexie(db.name)
    legacy.version(3).stores({
      templates: 'id',
      dictionaries: 'id, kind',
      settings: 'id',
      items: 'id, typeId, createdAt',
      photos: 'id, itemId',
    })
    const entries: DictionaryEntry[] = [
      ...DEFAULT_DICTIONARIES.filter(
        (entry) => entry.kind !== 'fineness' && !['amethyst', 'topaz'].includes(entry.id),
      ).map((entry) => {
        const result = { ...entry }
        delete result.color
        return result
      }),
      ...FINENESS_LABELS.map((label): DictionaryEntry => ({
        id: `fineness-${label}`,
        kind: 'fineness',
        label,
        enabled: label !== '999',
        revision: 1,
      })),
      { id: 'custom-assay', kind: 'fineness', label: 'Моя проба', enabled: true, revision: 3 },
      {
        id: 'my-amethyst',
        kind: 'stone',
        label: 'Аметист',
        color: '#553377',
        enabled: true,
        revision: 2,
      },
      { id: 'my-topaz', kind: 'stone', label: 'Топаз', enabled: false, revision: 4 },
    ]
    const snapshot = buildCardSnapshot(DEFAULT_TEMPLATE, entries, 'ring')
    const item = {
      id: 'old-item',
      revision: 8,
      typeId: 'ring',
      snapshot,
      materialIds: ['gold-white'],
      stoneIds: ['my-amethyst'],
      finenessId: 'fineness-585',
      weightGrams: 3,
      notes: 'История',
      customValues: {},
      photoIds: ['original'],
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    }
    const blob = new Blob(['original-bytes'], { type: 'image/png' })
    try {
      await legacy.table('templates').put(DEFAULT_TEMPLATE)
      await legacy.table('dictionaries').bulkPut(entries)
      await legacy
        .table('settings')
        .put({ id: 'appearance', revision: 7, themeMode: 'dark', accentTone: 'forest' })
      await legacy.table('items').put(item)
      await legacy.table('photos').put({
        id: 'original',
        itemId: item.id,
        blob,
        byteSize: blob.size,
        mimeType: blob.type,
        originalName: 'old.png',
        width: 1,
        height: 1,
      })
    } finally {
      legacy.close()
    }
    await db.open()
    const catalog = await getCatalog(db)
    expect(await readItems(db)).toEqual([item])
    expect(await (await readPhoto('original', db)).blob.text()).toBe('original-bytes')
    expect(await getAppearance(db)).toMatchObject({ revision: 7, accentTone: 'forest' })
    expect(catalog.entries.find((entry) => entry.id === 'custom-assay')).toEqual(
      entries.find((entry) => entry.id === 'custom-assay'),
    )
    expect(catalog.entries.filter((entry) => entry.label === 'Аметист')).toEqual([
      entries.find((entry) => entry.id === 'my-amethyst'),
    ])
    expect(catalog.entries.filter((entry) => entry.label === 'Топаз')).toHaveLength(1)
    expect(catalog.entries.find((entry) => entry.id === 'my-topaz')?.enabled).toBe(false)
    expect(
      catalog.entries
        .filter((entry) => entry.kind === 'fineness' && entry.label === '999')
        .every((entry) => !entry.enabled),
    ).toBe(true)
    const [old] = await readItems(db)
    const saved = await saveItem(
      {
        id: old.id,
        revision: old.revision,
        snapshot: old.snapshot,
        values: { ...itemValues(old), notes: 'Отредактировано' },
      },
      [],
      db,
    )
    expect(saved.finenessId).toBe('fineness-585')
    expect(saved.snapshot.fields.find((field) => field.id === 'fineness')).toEqual(
      snapshot.fields.find((field) => field.id === 'fineness'),
    )
    db.close()
    await db.open()
    expect((await getCatalog(db)).entries).toEqual(catalog.entries)
  })
})
