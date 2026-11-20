import type {
  CardSnapshot,
  CardValues,
  DictionaryEntry,
  DictionaryOption,
} from '../../template/model/template'

/** New choices use live labels; unchanged choices retain their historical labels. */
export function reconcileSelections(
  snapshot: CardSnapshot,
  values: CardValues,
  entries: DictionaryEntry[],
  previous?: CardValues,
): CardSnapshot {
  const result = structuredClone(snapshot)
  function merge(
    kind: DictionaryEntry['kind'],
    options: DictionaryOption[],
    selected: string[],
    retained: string[],
  ) {
    const merged = new Map(options.map((option) => [option.id, option]))
    for (const id of selected) {
      if (retained.includes(id) && merged.has(id)) continue
      const entry = entries.find((entry) => entry.id === id && entry.kind === kind && entry.enabled)
      if (!entry)
        throw new Error('Выбранный вариант справочника больше недоступен. Выберите другой вариант.')
      merged.set(id, { id, label: entry.label })
    }
    return [...merged.values()]
  }
  result.materials = merge(
    'material',
    result.materials,
    values.materialIds ?? [],
    previous?.materialIds ?? [],
  )
  result.stones = merge('stone', result.stones, values.stoneIds ?? [], previous?.stoneIds ?? [])
  for (const field of result.fields) {
    if (field.id === 'materials') field.options = result.materials.map((option) => ({ ...option }))
    if (field.id === 'stones') field.options = result.stones.map((option) => ({ ...option }))
    if (field.id === 'fineness')
      field.options = merge(
        'fineness',
        field.options ?? [],
        values.fineness ? [values.fineness] : [],
        previous?.fineness ? [previous.fineness] : [],
      )
  }
  return result
}
