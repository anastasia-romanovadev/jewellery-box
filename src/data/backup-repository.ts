import { z } from 'zod'
import { Unzip, strFromU8, strToU8, zip } from 'fflate'
import { database, type JewelleryDatabase } from './database'
import { initializeDatabase, readDataGeneration } from './catalog-repository'
import { parseItem, type PhotoRecord } from '../entities/jewelry/model/item'
import {
  parseTemplate,
  parseDictionaryEntry,
  normalizeDictionaryLabel,
} from '../entities/template/model/template'
import { validateTemplateReferences } from '../entities/template/model/template-definition'
import { JEWELRY_TYPES } from '../entities/template/model/jewelry-types'
import { metalPriceSchema } from '../entities/jewelry/model/pricing'

// Conservative initial limits, not a claim that a phone can handle this much in memory.
export const BACKUP_LIMITS = {
  archiveBytes: 256 * 1024 * 1024,
  manifestBytes: 10 * 1024 * 1024,
  files: 10001,
}
const invalid = () =>
  new Error(
    'Копия повреждена, неполна или имеет неподдерживаемый формат. Текущие данные не изменены.',
  )
const appearance = z
  .object({
    id: z.literal('appearance'),
    revision: z.number().int().positive().safe(),
    themeMode: z.enum(['system', 'light', 'dark']),
    accentTone: z.enum(['burgundy', 'forest', 'ochre', 'blue']),
  })
  .strict()
const photoMeta = z
  .object({
    id: z.string().min(1),
    itemId: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: z.string(),
    byteSize: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    path: z.string().regex(/^photos\/[0-9]+\.bin$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
const manifestSchema = z
  .object({
    format: z.literal('jewellery-box'),
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    template: z.unknown(),
    dictionaries: z.array(z.unknown()),
    settings: appearance,
    items: z.array(z.unknown()),
    metalPrices: z.array(metalPriceSchema),
    photos: z.array(photoMeta),
  })
  .strict()
type Manifest = ReturnType<typeof validateManifest>
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw invalid()
}
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  return crc >>> 0
})
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]
  return (crc ^ 0xffffffff) >>> 0
}

function verifyDirectory(bytes: Uint8Array, files: Map<string, Uint8Array>) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== files.size
  )
    throw invalid()
  let offset = view.getUint32(end + 16, true)
  if (offset + view.getUint32(end + 12, true) !== end) throw invalid()
  const names = new Set<string>()
  while (offset < end) {
    if (
      offset + 46 > end ||
      view.getUint32(offset, true) !== 0x02014b50 ||
      view.getUint16(offset + 10, true) !== 0 ||
      view.getUint16(offset + 8, true) & 1
    )
      throw invalid()
    const nameLength = view.getUint16(offset + 28, true)
    const next =
      offset +
      46 +
      nameLength +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true)
    if (next > end) throw invalid()
    const name = strFromU8(bytes.subarray(offset + 46, offset + 46 + nameLength))
    const data = files.get(name)
    if (
      !data ||
      names.has(name) ||
      data.length !== view.getUint32(offset + 20, true) ||
      data.length !== view.getUint32(offset + 24, true) ||
      crc32(data) !== view.getUint32(offset + 16, true)
    )
      throw invalid()
    names.add(name)
    offset = next
  }
  if (names.size !== files.size) throw invalid()
}
function validateManifest(raw: unknown) {
  const data = manifestSchema.parse(raw)
  const template = parseTemplate(data.template)
  const dictionaries = data.dictionaries.map(parseDictionaryEntry)
  const items = data.items.map(parseItem)
  for (const rows of [dictionaries, items, data.metalPrices, data.photos])
    unique(rows.map((row) => row.id))
  unique(data.photos.map((photo) => photo.path))
  unique(
    dictionaries
      .filter((entry) => entry.enabled)
      .map((entry) =>
        JSON.stringify([entry.kind, entry.metal, normalizeDictionaryLabel(entry.label)]),
      ),
  )
  validateTemplateReferences(template, dictionaries)
  for (const type of JEWELRY_TYPES) {
    const entry = dictionaries.find((entry) => entry.id === type.id)
    if (!entry || entry.kind !== 'type' || !entry.enabled || entry.sizeKind !== type.sizeKind)
      throw invalid()
  }
  const references = new Set<string>()
  for (const item of items) {
    if (!dictionaries.some((entry) => entry.id === item.typeId && entry.kind === 'type'))
      throw invalid()
    for (const [kind, ids] of [
      ['material', item.materialIds],
      ['stone', item.stoneIds],
      [
        'fineness',
        Object.values(
          item.materialFineness ?? (item.finenessId ? { legacy: item.finenessId } : {}),
        ),
      ],
    ] as const)
      for (const id of ids)
        if (!dictionaries.some((entry) => entry.id === id && entry.kind === kind)) throw invalid()
    for (const id of item.photoIds) {
      const photo = data.photos.find((photo) => photo.id === id)
      if (!photo || photo.itemId !== item.id || references.has(id)) throw invalid()
      references.add(id)
    }
  }
  if (references.size !== data.photos.length) throw invalid()
  return { ...data, template, dictionaries, items }
}
export type ValidatedBackup = {
  summary: { exportedAt: string; items: number; photos: number; totalBytes: number }
  manifest: Manifest
  photos: PhotoRecord[]
}
async function digest(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}
function tables(db: JewelleryDatabase) {
  return [
    db.templates,
    db.dictionaries,
    db.settings,
    db.items,
    db.photos,
    db.metalPrices,
    db.restoreState,
  ]
}
export async function exportBackup(db: JewelleryDatabase = database): Promise<Blob> {
  await initializeDatabase(db)
  const data = await db.transaction('r', tables(db), async () => ({
    template: await db.templates.get('creation'),
    dictionaries: await db.dictionaries.toArray(),
    settings: await db.settings.get('appearance'),
    items: await db.items.toArray(),
    photos: await db.photos.toArray(),
    metalPrices: await db.metalPrices.toArray(),
  }))
  if (
    data.photos.length + 1 > BACKUP_LIMITS.files ||
    data.photos.reduce((sum, photo) => sum + photo.blob.size, 0) > BACKUP_LIMITS.archiveBytes
  )
    throw new Error('Коллекция превышает текущий лимит копии 256 МиБ.')
  const files: Record<string, Uint8Array> = {}
  const photos = []
  for (const [index, photo] of data.photos.entries()) {
    const { blob, ...metadata } = photo
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (metadata.byteSize !== bytes.length || metadata.mimeType !== blob.type) throw invalid()
    const path = `photos/${index}.bin`
    files[path] = bytes
    photos.push({ ...metadata, path, sha256: await digest(bytes) })
  }
  const manifest = validateManifest({
    ...data,
    photos,
    format: 'jewellery-box',
    version: 1,
    exportedAt: new Date().toISOString(),
  })
  files['manifest.json'] = strToU8(JSON.stringify(manifest))
  if (
    files['manifest.json'].length > BACKUP_LIMITS.manifestBytes ||
    Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0) +
      files['manifest.json'].length +
      Object.keys(files).length * 256 >
      BACKUP_LIMITS.archiveBytes
  )
    throw new Error('Коллекция превышает текущий лимит копии 256 МиБ.')
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 0 }, (error, result) => (error ? reject(error) : resolve(result))),
  )
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' })
}
export async function inspectBackup(file: Blob): Promise<ValidatedBackup> {
  if (!file.size || file.size > BACKUP_LIMITS.archiveBytes)
    throw new Error('Выбери копию размером не более 256 МиБ.')
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    // v1 exports only stored ZIP entries, without comments or ZIP64.
    const end = new DataView(bytes.buffer)
    if (
      bytes.length < 22 ||
      end.getUint32(bytes.length - 22, true) !== 0x06054b50 ||
      end.getUint16(bytes.length - 2, true) !== 0
    )
      throw invalid()
    const files = new Map<string, Uint8Array>()
    const names = new Set<string>()
    let total = 0
    const unzip = new Unzip((entry) => {
      if (
        entry.compression !== 0 ||
        names.has(entry.name) ||
        names.size >= BACKUP_LIMITS.files ||
        !(entry.name === 'manifest.json' || /^photos\/[0-9]+\.bin$/.test(entry.name))
      )
        throw invalid()
      names.add(entry.name)
      const chunks: Uint8Array[] = []
      let size = 0
      entry.ondata = (error, chunk, final) => {
        if (error) throw error
        total += chunk.length
        size += chunk.length
        if (
          total > BACKUP_LIMITS.archiveBytes ||
          (entry.name === 'manifest.json' && size > BACKUP_LIMITS.manifestBytes)
        ) {
          entry.terminate()
          throw invalid()
        }
        chunks.push(chunk)
        if (final) {
          const data = new Uint8Array(size)
          let offset = 0
          for (const chunk of chunks) {
            data.set(chunk, offset)
            offset += chunk.length
          }
          files.set(entry.name, data)
        }
      }
      entry.start()
    })
    for (let offset = 0; offset < bytes.length; offset += 65536)
      unzip.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length)
    const json = files.get('manifest.json')
    if (!json || files.size !== names.size || end.getUint16(bytes.length - 12, true) !== files.size)
      throw invalid()
    verifyDirectory(bytes, files)
    const manifest = validateManifest(JSON.parse(strFromU8(json)))
    if (files.size !== manifest.photos.length + 1) throw invalid()
    const photos: PhotoRecord[] = []
    for (const { path, sha256, ...metadata } of manifest.photos) {
      const bytes = files.get(path)
      if (!bytes || bytes.length !== metadata.byteSize || (await digest(bytes)) !== sha256)
        throw invalid()
      photos.push({
        ...metadata,
        blob: new Blob([new Uint8Array(bytes)], { type: metadata.mimeType }),
      })
    }
    return {
      manifest,
      photos,
      summary: {
        exportedAt: manifest.exportedAt,
        items: manifest.items.length,
        photos: photos.length,
        totalBytes: photos.reduce((sum, photo) => sum + photo.byteSize, 0),
      },
    }
  } catch {
    throw invalid()
  }
}
export async function restoreBackup(
  backup: ValidatedBackup,
  db: JewelleryDatabase = database,
): Promise<void> {
  // Recheck the mutable object at the write boundary, including original bytes.
  const manifest = validateManifest(backup.manifest)
  if (backup.photos.length !== manifest.photos.length) throw invalid()
  unique(backup.photos.map((photo) => photo.id))
  for (const metadata of manifest.photos) {
    const photo = backup.photos.find((photo) => photo.id === metadata.id)
    if (
      !photo ||
      photo.itemId !== metadata.itemId ||
      photo.blob.size !== metadata.byteSize ||
      photo.blob.type !== metadata.mimeType ||
      (await digest(new Uint8Array(await photo.blob.arrayBuffer()))) !== metadata.sha256
    )
      throw invalid()
  }
  const photos = manifest.photos.map((metadata) => ({
    id: metadata.id,
    itemId: metadata.itemId,
    originalName: metadata.originalName,
    mimeType: metadata.mimeType,
    byteSize: metadata.byteSize,
    width: metadata.width,
    height: metadata.height,
    blob: backup.photos.find((photo) => photo.id === metadata.id)!.blob,
  }))
  await db.transaction('rw', tables(db), async () => {
    const current = [
      ...(await db.items.toArray()),
      ...(await db.dictionaries.toArray()),
      ...(await db.templates.toArray()),
      ...(await db.settings.toArray()),
      ...(await db.metalPrices.toArray()),
    ]
    const imported = [
      ...manifest.items,
      ...manifest.dictionaries,
      manifest.template,
      manifest.settings,
      ...manifest.metalPrices,
    ]
    const revision =
      [...current, ...imported].reduce((max, record) => Math.max(max, record.revision), 0) + 1
    const generation = (await readDataGeneration(db)) + 1
    if (!Number.isSafeInteger(revision) || !Number.isSafeInteger(generation)) throw invalid()
    // All stores are locked: racing writes finish before this point or see rebased revisions.
    for (const table of tables(db)) await table.clear()
    await db.templates.put({ ...manifest.template, revision })
    await db.settings.put({ ...manifest.settings, revision })
    await db.items.bulkPut(manifest.items.map((item) => ({ ...item, revision })))
    await db.dictionaries.bulkPut(manifest.dictionaries.map((entry) => ({ ...entry, revision })))
    await db.metalPrices.bulkPut(manifest.metalPrices.map((price) => ({ ...price, revision })))
    await db.photos.bulkPut(photos)
    await db.restoreState.put({ id: 'generation', value: generation })
  })
}
