import { describe, expect, it } from 'vitest'
import {
  buildCardSnapshot,
  DEFAULT_DICTIONARIES,
  DEFAULT_TEMPLATE,
  parseDictionaryEntry,
  parsePositiveNumber,
  parseTemplate,
  validateCardValues,
  validateTemplateReferences,
  type CardValues,
  type CreationTemplate,
  type DictionaryEntry,
  type TemplateField,
} from './template'

function template(): CreationTemplate {
  return structuredClone(DEFAULT_TEMPLATE)
}

function dictionaries(): DictionaryEntry[] {
  return structuredClone(DEFAULT_DICTIONARIES)
}

function customField(overrides: Partial<TemplateField> = {}): TemplateField {
  return {
    id: 'clasp',
    source: 'custom',
    label: 'Тип застёжки',
    kind: 'text',
    enabled: true,
    required: false,
    protected: false,
    scope: 'all',
    order: 8,
    ...overrides,
  }
}

function validValues(typeId = 'ring'): CardValues {
  return {
    typeId,
    materialIds: ['gold-white', 'gold-red'],
    stoneIds: ['diamond', 'ruby'],
    fineness: 'fineness-585',
    weightGrams: '3,25',
    photoIds: ['photo-1'],
    customValues: {},
  }
}

describe('template boundary validation', () => {
  it('defaults legacy fields to visible and only permits hiding fields other than type', () => {
    const legacy = {
      ...template(),
      fields: template().fields.map((field) => {
        const { enabled, ...rest } = field
        expect(enabled).toBe(true)
        return rest
      }),
    }
    expect(parseTemplate(legacy).fields.every((field) => field.enabled)).toBe(true)
    const hidden = template()
    hidden.fields = hidden.fields.map((field) => ({ ...field, enabled: field.id === 'type' }))
    expect(parseTemplate(hidden)).toEqual(hidden)
    const snapshot = buildCardSnapshot(hidden, dictionaries(), 'ring')
    expect(snapshot.fields.map((field) => field.id)).toEqual(['type'])
    expect(validateCardValues(snapshot, { typeId: 'ring', customValues: {} })).toEqual({})
  })

  it('visibility affects only new snapshots and restores mandatory validation when enabled', () => {
    const draft = template()
    draft.fields.push(customField())
    const previous = buildCardSnapshot(draft, dictionaries(), 'ring')
    draft.fields = draft.fields.map((field) => ({ ...field, enabled: field.id === 'type' }))
    const hidden = buildCardSnapshot(draft, dictionaries(), 'ring')
    expect(previous.fields.some((field) => field.id === 'clasp')).toBe(true)
    expect(validateCardValues(previous, { customValues: {} })).toHaveProperty('fineness')
    expect(validateCardValues(hidden, { typeId: 'ring', customValues: {} })).toEqual({})
    expect(validateCardValues(hidden, { customValues: { clasp: 'hidden value' } })).toHaveProperty(
      'customValues.clasp',
    )
    draft.fields = draft.fields.map((field) => ({ ...field, enabled: true }))
    expect(
      validateCardValues(buildCardSnapshot(draft, dictionaries(), 'ring'), { customValues: {} }),
    ).toHaveProperty('weightGrams')
  })
  it('accepts a renamed/reordered custom field without changing its ID', () => {
    const draft = template()
    draft.fields.push(customField({ label: '  Застёжка  ', order: 20 }))
    const parsed = parseTemplate(draft)
    expect(parsed.fields.at(-1)).toMatchObject({ id: 'clasp', label: 'Застёжка', order: 20 })
  })

  it.each(['photos', 'materials', 'fineness', 'weight', 'notes', 'type'])(
    'rejects deletion of protected %s',
    (id) => {
      const draft = template()
      draft.fields = draft.fields.filter((field) => field.id !== id)
      expect(() => parseTemplate(draft)).toThrow()
    },
  )

  it('prevents mandatory fields from being weakened or hidden in a type scope', () => {
    const draft = template()
    const weight = draft.fields.find((field) => field.id === 'weight')!
    weight.required = false
    expect(() => parseTemplate(draft)).toThrow()
    weight.required = true
    weight.scope = ['ring']
    expect(() => parseTemplate(draft)).toThrow()
  })

  it('allows optional builtins to be removed and protected fields to be reordered', () => {
    const draft = template()
    draft.fields = draft.fields.filter((field) => field.id !== 'stones')
    draft.fields[0].order = 20
    expect(parseTemplate(draft).fields).toHaveLength(DEFAULT_TEMPLATE.fields.length - 1)
  })

  it.each([
    { label: '   ' },
    { kind: 'number' as const },
    { required: true },
    { protected: true },
    { scope: [] },
    { scope: ['ring', 'ring'] },
    { scope: ['all'] },
    { id: 'weight' },
  ])('rejects invalid custom definition %j', (overrides) => {
    const draft = template()
    draft.fields.push(customField(overrides))
    expect(() => parseTemplate(draft)).toThrow()
  })

  it('rejects duplicate IDs and duplicate positions', () => {
    const draft = template()
    draft.fields.push(customField())
    draft.fields.push(customField({ order: 9 }))
    expect(() => parseTemplate(draft)).toThrow()
    draft.fields.at(-1)!.id = 'other-custom'
    draft.fields.at(-1)!.order = 8
    expect(() => parseTemplate(draft)).toThrow()
  })

  it('rejects unknown type scopes but preserves references to disabled types', () => {
    const draft = template()
    draft.fields.push(customField({ scope: ['missing-type'] }))
    expect(() => validateTemplateReferences(draft, dictionaries())).toThrow('неизвестный тип')
    draft.fields.at(-1)!.scope = ['ring']
    const entries = dictionaries()
    entries.find((entry) => entry.id === 'ring')!.enabled = false
    expect(() => validateTemplateReferences(draft, entries)).not.toThrow()
  })
})

describe('dictionary boundary validation', () => {
  it('trims labels without changing IDs or revisions', () => {
    expect(
      parseDictionaryEntry({
        id: 'silver',
        kind: 'material',
        label: '  Серебро  ',
        revision: 4,
        enabled: true,
      }),
    ).toEqual({ id: 'silver', kind: 'material', label: 'Серебро', revision: 4, enabled: true })
  })

  it('rejects empty names, reserved filter IDs, invalid revisions and misplaced size rules', () => {
    const material = {
      id: 'silver',
      kind: 'material',
      label: 'Серебро',
      revision: 1,
      enabled: true,
    }
    for (const changes of [{ label: '' }, { id: 'all' }, { revision: -1 }, { sizeKind: 'ring' }]) {
      expect(() => parseDictionaryEntry({ ...material, ...changes })).toThrow()
    }
    expect(() => parseDictionaryEntry({ ...material, kind: 'type' })).toThrow()
  })
})

describe('independent card snapshots', () => {
  it('combines common and matching specific fields in their stored order', () => {
    const draft = template()
    draft.fields.push(customField({ order: 10 }))
    draft.fields.push(
      customField({ id: 'ring-extra', label: 'Гравировка', scope: ['ring'], order: 9 }),
    )
    const ring = buildCardSnapshot(draft, dictionaries(), 'ring')
    expect(ring.fields.slice(-2).map((field) => field.id)).toEqual(['ring-extra', 'clasp'])
    expect(
      buildCardSnapshot(draft, dictionaries(), 'chain').fields.some(
        (field) => field.id === 'ring-extra',
      ),
    ).toBe(false)
  })

  it('keeps old fields, units and dictionary labels when current definitions are changed', () => {
    const draft = template()
    draft.fields.push(customField({ scope: ['chain'] }))
    const entries = dictionaries()
    const snapshot = buildCardSnapshot(draft, entries, 'chain')
    draft.fields = draft.fields.filter((field) => field.id !== 'clasp')
    entries.find((entry) => entry.id === 'gold-white')!.label = 'Новое название'
    entries.find((entry) => entry.id === 'gold-red')!.enabled = false
    entries.find((entry) => entry.id === 'chain')!.sizeKind = 'none'
    expect(snapshot.fields.find((field) => field.id === 'clasp')?.scope).toEqual(['chain'])
    expect(snapshot.fields.find((field) => field.id === 'size')?.unit).toBe('см')
    expect(snapshot.materials.find((entry) => entry.id === 'gold-white')?.label).toBe(
      'Белое золото',
    )
    expect(
      validateCardValues(snapshot, { ...validValues('chain'), customValues: { clasp: 'Карабин' } }),
    ).toEqual({})
    const next = buildCardSnapshot(draft, entries, 'chain')
    expect(next.fields.some((field) => field.id === 'clasp')).toBe(false)
    expect(next.fields.some((field) => field.id === 'size')).toBe(false)
    expect(next.materials.some((entry) => entry.id === 'gold-red')).toBe(false)
  })

  it('does not build a new card from a deleted type or unknown type', () => {
    const entries = dictionaries()
    entries.find((entry) => entry.id === 'ring')!.enabled = false
    expect(() => buildCardSnapshot(template(), entries, 'ring')).toThrow()
    expect(() => buildCardSnapshot(template(), entries, 'missing')).toThrow()
  })

  it('rejects forged dictionary entries when building a snapshot', () => {
    const entries = dictionaries()
    entries[0].label = ''
    expect(() => buildCardSnapshot(template(), entries, 'ring')).toThrow()
  })
})

describe('card value validation', () => {
  it('accepts several materials and stones, comma decimals and empty optional notes', () => {
    const snapshot = buildCardSnapshot(template(), dictionaries(), 'ring')
    expect(validateCardValues(snapshot, { ...validValues(), size: '16,5', notes: '' })).toEqual({})
    expect(parsePositiveNumber('3,25')).toBe(3.25)
  })

  it.each(['', ' ', '0', '-1', 'Infinity', 'NaN', '1,2,3', Infinity, NaN])(
    'rejects invalid weight %s',
    (weightGrams) => {
      const snapshot = buildCardSnapshot(template(), dictionaries(), 'ring')
      expect(validateCardValues(snapshot, { ...validValues(), weightGrams })).toHaveProperty(
        'weightGrams',
      )
    },
  )

  it('requires fineness, photos and materials without storing builtin values as custom fields', () => {
    const snapshot = buildCardSnapshot(template(), dictionaries(), 'ring')
    const errors = validateCardValues(snapshot, {
      ...validValues(),
      fineness: ' ',
      photoIds: [],
      materialIds: [],
      customValues: { weight: '5' },
    })
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['fineness', 'photoIds', 'materialIds', 'customValues.weight']),
    )
  })

  it('rejects selections that are not in the saved snapshot and duplicate selections', () => {
    const snapshot = buildCardSnapshot(template(), dictionaries(), 'ring')
    const errors = validateCardValues(snapshot, {
      ...validValues(),
      materialIds: ['silver', 'silver'],
      stoneIds: ['invented-stone'],
    })
    expect(errors).toHaveProperty('materialIds')
    expect(errors).toHaveProperty('stoneIds')
  })

  it('validates earrings as named sizes rather than numeric ring sizes', () => {
    const snapshot = buildCardSnapshot(template(), dictionaries(), 'earrings')
    expect(validateCardValues(snapshot, { ...validValues('earrings'), size: 'small' })).toEqual({})
    expect(
      validateCardValues(snapshot, { ...validValues('earrings'), size: '16,5' }),
    ).toHaveProperty('size')
  })

  it('does not silently reinterpret a value after an uncoordinated type change', () => {
    const snapshot = buildCardSnapshot(template(), dictionaries(), 'ring')
    expect(
      validateCardValues(snapshot, { ...validValues('earrings'), size: '16,5' }),
    ).toHaveProperty('typeId')
  })

  it('validates external value shape at runtime', () => {
    const snapshot = buildCardSnapshot(template(), dictionaries(), 'ring')
    expect(
      validateCardValues(snapshot, { ...validValues(), materialIds: 'silver' }),
    ).toHaveProperty('materialIds')
    expect(validateCardValues(snapshot, null)).toHaveProperty('form')
  })
})
