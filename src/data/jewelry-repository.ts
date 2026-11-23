import { z } from 'zod'
import { database, type JewelleryDatabase } from './database'
import { ConflictError, initializeDatabase, readDataGeneration } from './catalog-repository'
import {
  parseDictionaryEntry,
  parseCardSnapshot,
  validateCardValues,
} from '../entities/template/model/template'
import {
  changeItemType,
  itemValues,
  normalizeValues,
  parseItem,
  type JewelryDraft,
  type NewPhoto,
} from '../entities/jewelry/model/item'
import { reconcileSelections } from '../entities/jewelry/model/selected-options'

const photoSchema = z
  .object({
    id: z.string().min(1),
    blob: z.custom<Blob>((value) => value instanceof Blob).refine((blob) => blob.size > 0),
    originalName: z.string().min(1),
    mimeType: z.string(),
    byteSize: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict()
  .refine((photo) => photo.byteSize === photo.blob.size && photo.mimeType === photo.blob.type)

export async function readItems(db: JewelleryDatabase = database) {
  return (await db.items.toArray()).map(parseItem)
}
export async function readPhoto(id: string, db: JewelleryDatabase = database) {
  const value = await db.photos.get(id)
  if (!value) throw new Error('Фотография не найдена')
  const { itemId, ...photo } = value
  if (typeof itemId !== 'string' || !itemId) throw new Error('Повреждены данные фотографии')
  return { ...photoSchema.parse(photo), itemId }
}

export async function readItemPhotos(
  itemId: string,
  photoIds: string[],
  db: JewelleryDatabase = database,
) {
  return db.transaction('r', db.items, db.photos, async () => {
    const raw = await db.items.get(itemId)
    if (!raw) throw new Error('Карточка больше недоступна')
    const item = parseItem(raw)
    if (
      !photoIds.length ||
      photoIds.length > 5 ||
      new Set(photoIds).size !== photoIds.length ||
      photoIds.some((id) => !item.photoIds.includes(id))
    )
      throw new Error('Фотографии карточки изменились. Открой её заново.')
    return Promise.all(
      photoIds.map(async (id) => {
        const photo = await readPhoto(id, db)
        if (photo.itemId !== itemId) throw new Error('Фотография не принадлежит этой карточке')
        return photo
      }),
    )
  })
}
export async function saveItem(
  draft: JewelryDraft,
  newPhotos: NewPhoto[],
  db: JewelleryDatabase = database,
  expectedGeneration?: number,
) {
  const photos = newPhotos.map((photo) => photoSchema.parse(photo))
  if (new Set(photos.map((photo) => photo.id)).size !== photos.length)
    throw new Error('Фотографии повторяются')
  await initializeDatabase(db)
  return db.transaction('rw', [db.items, db.photos, db.dictionaries, db.restoreState], async () => {
    if (expectedGeneration !== undefined && expectedGeneration !== (await readDataGeneration(db)))
      throw new ConflictError()
    const raw = await db.items.get(draft.id)
    const current = raw ? parseItem(raw) : undefined
    if (current ? current.revision !== draft.revision : draft.revision !== 0)
      throw new ConflictError()
    const entries = (await db.dictionaries.toArray()).map(parseDictionaryEntry)
    const type = entries.find(
      (entry) => entry.kind === 'type' && entry.id === draft.values.typeId && entry.enabled,
    )
    if (!type) throw new Error('Выбери доступный тип изделия')
    let snapshot = current
      ? changeItemType(current.snapshot, itemValues(current), type).snapshot
      : parseCardSnapshot(draft.snapshot)
    if (snapshot.typeId !== type.id || !snapshot.fields.some((field) => field.id === 'type'))
      throw new Error('Некорректная схема типа изделия')
    snapshot = reconcileSelections(
      snapshot,
      draft.values,
      entries,
      current ? itemValues(current) : undefined,
    )
    const errors = validateCardValues(snapshot, draft.values)
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
    const now = new Date().toISOString()
    const item = parseItem({
      id: draft.id,
      revision: (current?.revision ?? 0) + 1,
      snapshot,
      ...normalizeValues(snapshot, draft.values),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    })
    for (const photoId of item.photoIds) {
      const existing = await db.photos.get(photoId)
      const added = photos.find((photo) => photo.id === photoId)
      if (existing) {
        if (existing.itemId !== item.id || added)
          throw new Error('Фотография принадлежит другой записи или имеет повторный ID')
      } else {
        if (!added) throw new Error('Фотография отсутствует')
        await db.photos.add({ ...added, itemId: item.id })
      }
    }
    for (const photoId of current?.photoIds ?? []) {
      if (!item.photoIds.includes(photoId)) await db.photos.delete(photoId)
    }
    await db.items.put(item)
    return item
  })
}
export async function deleteItem(id: string, revision: number, db: JewelleryDatabase = database) {
  return db.transaction('rw', db.items, db.photos, async () => {
    const raw = await db.items.get(id)
    if (!raw || parseItem(raw).revision !== revision) throw new ConflictError()
    await db.photos.where('itemId').equals(id).delete()
    await db.items.delete(id)
  })
}
