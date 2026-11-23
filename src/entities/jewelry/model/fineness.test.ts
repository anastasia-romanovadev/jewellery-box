import { describe, expect, it } from 'vitest'
import { matchesMaterials } from '../../template/model/material-fineness'

describe('fineness by material', () => {
  it.each(['gold-white', 'gold-red', 'gold-yellow'])('uses gold fineness for %s', (id) => {
    expect(matchesMaterials({ metal: 'gold' }, [id])).toBe(true)
    expect(matchesMaterials({ metal: 'silver' }, [id])).toBe(false)
    expect(matchesMaterials({ metal: 'platinum' }, [id])).toBe(false)
  })
  it('combines selected metals, requires a material and limits ungrouped choices to other materials', () => {
    expect(matchesMaterials({ metal: 'gold' }, [])).toBe(false)
    expect(matchesMaterials({}, [])).toBe(false)
    expect(matchesMaterials({ metal: 'gold' }, ['gold-white', 'silver'])).toBe(true)
    expect(matchesMaterials({ metal: 'silver' }, ['gold-white', 'silver'])).toBe(true)
    expect(matchesMaterials({ metal: 'platinum' }, ['gold-white', 'silver'])).toBe(false)
    expect(matchesMaterials({ metal: 'platinum' }, ['platinum'])).toBe(true)
    expect(matchesMaterials({}, ['silver'])).toBe(false)
    expect(matchesMaterials({}, ['custom-metal'])).toBe(true)
  })
})
