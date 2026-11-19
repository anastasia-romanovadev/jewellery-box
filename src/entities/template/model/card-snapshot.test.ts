import { describe, expect, it } from 'vitest'
import { buildCardSnapshot, parseCardSnapshot } from './card-snapshot'
import { DEFAULT_DICTIONARIES, DEFAULT_TEMPLATE } from './defaults'

describe('saved snapshot boundary', () => {
  it.each(['ring', 'earrings', 'chain', 'brooch'])(
    'round-trips a %s snapshot through JSON',
    (typeId) => {
      const snapshot = buildCardSnapshot(DEFAULT_TEMPLATE, DEFAULT_DICTIONARIES, typeId)
      expect(parseCardSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
    },
  )

  it('preserves historical labels without consulting current dictionaries or requiring hidden fields', () => {
    const template = structuredClone(DEFAULT_TEMPLATE)
    template.fields.forEach((field) => {
      field.enabled = false
    })
    const snapshot = buildCardSnapshot(template, DEFAULT_DICTIONARIES, 'ring')
    snapshot.typeLabel = 'Историческое название'
    snapshot.materials = [{ id: 'deleted-material', label: 'Удалённый материал' }]
    expect(parseCardSnapshot(snapshot)).toEqual(snapshot)
    expect(parseCardSnapshot(snapshot)).not.toBe(snapshot)
  })

  it('rejects malformed data, duplicate IDs and invalid field definitions', () => {
    const snapshot = buildCardSnapshot(DEFAULT_TEMPLATE, DEFAULT_DICTIONARIES, 'ring')
    expect(() => parseCardSnapshot({ ...snapshot, templateRevision: '1' })).toThrow()
    expect(() =>
      parseCardSnapshot({ ...snapshot, fields: [...snapshot.fields, snapshot.fields[0]] }),
    ).toThrow()
    expect(() =>
      parseCardSnapshot({
        ...snapshot,
        materials: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      }),
    ).toThrow()
    expect(() =>
      parseCardSnapshot({ ...snapshot, fields: [{ ...snapshot.fields[0], enabled: false }] }),
    ).toThrow()
    expect(() =>
      parseCardSnapshot({ ...snapshot, fields: [{ ...snapshot.fields[0], kind: 'text' }] }),
    ).toThrow()
    expect(() =>
      parseCardSnapshot({ ...snapshot, fields: [{ ...snapshot.fields[0], source: 'custom' }] }),
    ).toThrow()
  })
})
