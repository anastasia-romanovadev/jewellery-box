import { describe, expect, it } from 'vitest'
import { countComment, leaderComment, valueComment, weightComment } from './playful-copy'

describe('personal analytics comments', () => {
  it('assigns exact weight and count boundaries to the next tier', () => {
    expect(weightComment(49.999)).not.toBe(weightComment(50))
    expect(weightComment(50)).toBe(weightComment(99.999))
    expect(weightComment(100)).not.toBe(weightComment(99.999))
    expect(countComment(9)).not.toBe(countComment(10))
    expect(countComment(10)).toBe(countComment(19))
    expect(countComment(20)).not.toBe(countComment(19))
  })
  it.each([50_000, 150_000, 500_000, 1_000_000, 2_000_000])(
    'switches monetary comments at %i rubles without gaps',
    (boundary) => {
      expect(valueComment(boundary - 0.01)).not.toBe(valueComment(boundary))
      expect(valueComment(boundary)).toBe(valueComment(boundary + 0.01))
    },
  )
  it.each([0, 1, 2])('keeps actual leaders and tied weights in variant %i', (variant) => {
    const text = leaderComment(['Кольца', 'Броши'], '12,5', variant)
    expect(text).toContain('«Кольца», «Броши»')
    expect(text).toContain('12,5 г в каждой категории')
  })
})
