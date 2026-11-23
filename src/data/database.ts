import Dexie, { type Table } from 'dexie'
import type { MetalPrice } from '../entities/jewelry/model/pricing'
import {
  DEFAULT_TEMPLATE,
  parseTemplate,
  normalizeDictionaryLabel,
  type CreationTemplate,
  type DictionaryEntry,
} from '../entities/template/model/template'
import type { AppearanceSettings } from '../shared/lib/appearance-cache'
import type { JewelryItem, PhotoRecord } from '../entities/jewelry/model/item'
import { DEFAULT_DICTIONARIES, FINENESS_LABELS } from '../entities/template/model/defaults'

export type AppearanceRecord = AppearanceSettings & { id: 'appearance'; revision: number }

export class JewelleryDatabase extends Dexie {
  templates!: Table<CreationTemplate, string>
  dictionaries!: Table<DictionaryEntry, string>
  settings!: Table<AppearanceRecord, string>
  items!: Table<JewelryItem, string>
  photos!: Table<PhotoRecord, string>
  metalPrices!: Table<MetalPrice, string>
  restoreState!: Table<{ id: 'generation'; value: number }, string>

  constructor(name = 'jewellery-box') {
    super(name)
    // First durable schema. Future changes must add a version, never clear user data.
    this.version(1).stores({
      templates: 'id',
      dictionaries: 'id, kind',
      settings: 'id',
    })
    this.version(2)
      .stores({
        templates: 'id',
        dictionaries: 'id, kind',
        settings: 'id',
      })
      .upgrade(async (transaction) => {
        const templates = transaction.table<CreationTemplate, string>('templates')
        for (const value of await templates.toArray()) {
          // Runtime parsing supplies enabled=true to v1 definitions without changing IDs/revisions.
          const template = parseTemplate({
            ...value,
            fields: value.fields.map((field) =>
              field.id === 'type' ? { ...field, enabled: true } : field,
            ),
          })
          let order = Math.max(-1, ...template.fields.map((field) => field.order)) + 1
          for (const field of DEFAULT_TEMPLATE.fields) {
            if (!field.protected && !template.fields.some((existing) => existing.id === field.id)) {
              template.fields.push({ ...field, enabled: false, order: order++ })
            }
          }
          await templates.put(template)
        }
      })
    this.version(3)
      .stores({
        templates: 'id',
        dictionaries: 'id, kind',
        settings: 'id',
        items: 'id, typeId, createdAt',
        photos: 'id, itemId',
      })
      .upgrade(async (transaction) => {
        const templates = transaction.table<CreationTemplate, string>('templates')
        const template = await templates.get('creation')
        if (template) {
          const changed = template.fields.some((field) => field.id === 'type' && !field.enabled)
          await templates.put(
            parseTemplate({
              ...template,
              revision: template.revision + (changed ? 1 : 0),
              fields: template.fields.map((field) =>
                field.id === 'type' ? { ...field, enabled: true } : field,
              ),
            }),
          )
          const dictionaries = transaction.table<DictionaryEntry, string>('dictionaries')
          // Keep the historical v3 migration independent of later seed changes.
          for (const entry of FINENESS_LABELS.map((label): DictionaryEntry => ({
            id: `fineness-${label}`,
            kind: 'fineness',
            label,
            enabled: true,
            revision: 1,
          }))) {
            if (!(await dictionaries.get(entry.id))) await dictionaries.add(entry)
          }
          // Fixed categories are selectable again after the former editable-type prototype.
          for (const entry of DEFAULT_DICTIONARIES.filter((entry) => entry.kind === 'type')) {
            const existing = await dictionaries.get(entry.id)
            if (!existing) await dictionaries.add(entry)
            else if (!existing.enabled)
              await dictionaries.put({
                ...existing,
                enabled: true,
                revision: existing.revision + 1,
              })
          }
        }
      })
    this.version(4)
      .stores({
        templates: 'id',
        dictionaries: 'id, kind',
        settings: 'id',
        items: 'id, typeId, createdAt',
        photos: 'id, itemId',
      })
      .upgrade(async (transaction) => {
        const dictionaries = transaction.table<DictionaryEntry, string>('dictionaries')
        const existing = await dictionaries.toArray()
        for (const seed of DEFAULT_DICTIONARIES.filter((entry) => entry.kind === 'fineness')) {
          const legacy = existing.find((entry) => entry.id === `fineness-${seed.label}`)
          if (!existing.some((entry) => entry.id === seed.id))
            await dictionaries.add({ ...seed, enabled: legacy?.enabled ?? true })
        }
        for (const entry of existing) {
          // Keep custom labels and every historical ID; never rewrite card snapshots.
          if (
            entry.kind === 'fineness' &&
            !entry.metal &&
            entry.id === `fineness-${entry.label}` &&
            FINENESS_LABELS.includes(entry.label) &&
            entry.enabled
          )
            await dictionaries.put({ ...entry, enabled: false, revision: entry.revision + 1 })
        }
        for (const seed of DEFAULT_DICTIONARIES.filter((entry) => entry.kind === 'stone')) {
          const match = existing.find(
            (entry) =>
              entry.kind === 'stone' &&
              normalizeDictionaryLabel(entry.label) === normalizeDictionaryLabel(seed.label),
          )
          if (match) {
            if (!match.color)
              await dictionaries.put({ ...match, color: seed.color, revision: match.revision + 1 })
          } else if (
            ['amethyst', 'topaz'].includes(seed.id) &&
            !existing.some((entry) => entry.id === seed.id)
          ) {
            await dictionaries.add(seed)
          }
        }
      })
    // v5 introduces per-material assays. Legacy rows remain readable without guessing associations.
    this.version(5).stores({
      templates: 'id',
      dictionaries: 'id, kind',
      settings: 'id',
      items: 'id, typeId, createdAt',
      photos: 'id, itemId',
    })
    this.version(6)
      .stores({
        templates: 'id',
        dictionaries: 'id, kind',
        settings: 'id',
        items: 'id, typeId, createdAt',
        photos: 'id, itemId',
      })
      .upgrade(async (transaction) => {
        const dictionaries = transaction.table<DictionaryEntry, string>('dictionaries')
        if (
          (await transaction.table('templates').get('creation')) &&
          !(await dictionaries.get('pendant'))
        ) {
          await dictionaries.add({
            id: 'pendant',
            kind: 'type',
            label: 'Подвески',
            sizeKind: 'none',
            enabled: true,
            revision: 1,
          })
        }
      })
    this.version(7).stores({ metalPrices: 'id' })
    this.version(8).stores({ restoreState: 'id' })
  }
}

export const database = new JewelleryDatabase()
