export type SizeKind = 'none' | 'ring' | 'length' | 'earring'
export type DictionaryKind = 'type' | 'material' | 'stone'

export type DictionaryEntry = {
  id: string
  kind: DictionaryKind
  label: string
  enabled: boolean
  revision: number
  sizeKind?: SizeKind
}

export type TemplateField = {
  id: string
  source: 'builtin' | 'custom'
  label: string
  kind: 'text' | 'number' | 'photos' | 'multi-select' | 'type' | 'size'
  enabled: boolean
  required: boolean
  protected: boolean
  scope: 'all' | string[]
  order: number
}

export type CreationTemplate = {
  id: 'creation'
  revision: number
  fields: TemplateField[]
}

export type DictionaryOption = { id: string; label: string }
export type SnapshotField = TemplateField & { unit?: string; options?: DictionaryOption[] }
export type CardSnapshot = {
  templateRevision: number
  typeId: string
  typeLabel: string
  sizeKind: SizeKind
  fields: SnapshotField[]
  materials: DictionaryOption[]
  stones: DictionaryOption[]
}
