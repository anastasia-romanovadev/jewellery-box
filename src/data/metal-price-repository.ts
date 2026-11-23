import { metalPriceSchema, type MetalPrice } from '../entities/jewelry/model/pricing'
import { database, type JewelleryDatabase } from './database'
import { ConflictError, readDataGeneration } from './catalog-repository'

export async function readMetalPrices(db: JewelleryDatabase = database) {
  return (await db.metalPrices.toArray()).map((entry) => metalPriceSchema.parse(entry))
}

export async function saveMetalPrice(
  draft: MetalPrice,
  db: JewelleryDatabase = database,
  expectedGeneration?: number,
) {
  const parsed = metalPriceSchema.parse(draft)
  return db.transaction('rw', db.metalPrices, db.restoreState, async () => {
    if (expectedGeneration !== undefined && expectedGeneration !== (await readDataGeneration(db)))
      throw new ConflictError()
    const raw = await db.metalPrices.get(parsed.id)
    const current = raw ? metalPriceSchema.parse(raw) : undefined
    if ((current?.revision ?? 0) !== parsed.revision) throw new ConflictError()
    const saved = { ...parsed, revision: parsed.revision + 1 }
    await db.metalPrices.put(saved)
    return saved
  })
}
