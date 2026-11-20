import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_TEMPLATE,
  parseTemplate,
  type CreationTemplate,
  type DictionaryEntry,
} from '../entities/template/model/template'
import type { AppearanceSettings } from '../shared/lib/appearance-cache'
import type { JewelryItem, PhotoRecord } from '../entities/jewelry/model/item'
import { DEFAULT_DICTIONARIES } from '../entities/template/model/defaults'

export type AppearanceRecord = AppearanceSettings & { id: 'appearance'; revision: number }

export class JewelleryDatabase extends Dexie {
  templates!: Table<CreationTemplate, string>
  dictionaries!: Table<DictionaryEntry, string>
  settings!: Table<AppearanceRecord, string>
  items!: Table<JewelryItem, string>
  photos!: Table<PhotoRecord, string>

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
          for (const entry of DEFAULT_DICTIONARIES.filter((entry) => entry.kind === 'fineness')) {
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
  }
}

export const database = new JewelleryDatabase()
