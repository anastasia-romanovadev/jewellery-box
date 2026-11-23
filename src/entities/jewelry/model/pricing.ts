import { z } from 'zod'

export const metalPriceSchema = z.object({
  id: z.enum(['gold', 'silver', 'platinum']),
  pricePerGram: z.number().positive().max(1_000_000_000).nullable(),
  revision: z.number().int().nonnegative(),
})
export type MetalPrice = z.infer<typeof metalPriceSchema>

export function parsePriceInput(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error('Введи положительную цену, не более двух знаков после запятой.')
  const price = Number(normalized)
  if (price <= 0 || price > 1_000_000_000)
    throw new Error('Введи цену больше нуля и не более 1 000 000 000 ₽.')
  return price
}

export const formatRubles = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
