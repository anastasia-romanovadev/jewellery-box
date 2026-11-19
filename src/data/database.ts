import Dexie, { type Table } from 'dexie'
import {
  DEFAULT_TEMPLATE,
  parseTemplate,
  type CreationTemplate,
  type DictionaryEntry,
} from '../entities/template/model/template'
import type { AppearanceSettings } from '../shared/lib/appearance-cache'

export type AppearanceRecord = AppearanceSettings & { id: 'appearance'; revision: number }

export class JewelleryDatabase extends Dexie {
  templates!: Table<CreationTemplate, string>
  dictionaries!: Table<DictionaryEntry, string>
  settings!: Table<AppearanceRecord, string>

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
          const template = parseTemplate(value)
          let order = Math.max(-1, ...template.fields.map((field) => field.order)) + 1
          for (const field of DEFAULT_TEMPLATE.fields) {
            if (!field.protected && !template.fields.some((existing) => existing.id === field.id)) {
              template.fields.push({ ...field, enabled: false, order: order++ })
            }
          }
          await templates.put(template)
        }
      })
  }
}

export const database = new JewelleryDatabase()
