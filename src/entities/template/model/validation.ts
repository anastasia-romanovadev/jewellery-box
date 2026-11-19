import { z } from 'zod'

export const identifier = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value, 'Некорректный ID')
export const label = z.string().trim().min(1, 'Введите название')
export const sizeKindSchema = z.enum(['none', 'ring', 'length', 'earring'])
