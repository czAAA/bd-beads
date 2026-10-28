// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { FRAME_KIND_IDS, frameKindOf } from './frameKind'
import { settingValue, type SettingSpec } from './settingSpec'
import { describeWeave, TECHNIQUES } from './weave'

describe('settingValue (ticket 0624)', () => {
  /** A setting that goes by two, from 3 to 9. */
  const odd: SettingSpec = { id: 'odd', labelKey: 'odd', min: 3, max: 9, step: 2, default: 3 }

  it('keeps a value within its range, on one of its steps from the minimum', () => {
    expect([1, 3, 4, 8, 9, 12].map((value) => settingValue(odd, value))).toEqual([3, 3, 3, 7, 9, 9])
    expect(settingValue(odd, 5.4)).toBe(5)
  })

  it('reads none or no number as its default', () => {
    expect(settingValue(odd, undefined)).toBe(3)
    expect(settingValue(odd, Number.NaN)).toBe(3)
  })
})

describe('every registry\'s settings (ADR 0078, ticket 0624)', () => {
  const onStep = (setting: SettingSpec, value: number) => Number.isInteger((value - setting.min) / setting.step)

  /** What is wrong with one owner's settings: their ids, their bounds, and their default and presets inside them. */
  function problems(owner: string, settings: readonly SettingSpec[]): string[] {
    const ids = settings.map((setting) => setting.id)
    return settings.flatMap((setting) => {
      const found: string[] = []
      if (ids.indexOf(setting.id) !== ids.lastIndexOf(setting.id)) found.push('id twice')
      if (!setting.labelKey) found.push('no label key')
      if (!(setting.step > 0 && setting.min <= setting.max && onStep(setting, setting.max))) found.push('bounds')
      if (!(setting.default >= setting.min && setting.default <= setting.max && onStep(setting, setting.default))) found.push('default out of bounds')
      if (setting.presets?.some((preset) => preset < setting.min || preset > setting.max || !onStep(setting, preset))) found.push('preset out of bounds')
      if (setting.below !== undefined && !ids.includes(setting.below)) found.push(`below an unknown ${setting.below}`)
      return found.map((problem) => `${owner} ${setting.id}: ${problem}`)
    })
  }

  it('gives every Technique\'s setting a default and presets inside its bounds', () => {
    expect(TECHNIQUES.flatMap((technique) => problems(technique, describeWeave({ technique }).settings))).toEqual([])
  })

  it('gives every Frame kind\'s setting a default and presets inside its bounds', () => {
    expect(FRAME_KIND_IDS.flatMap((kind) => problems(kind, frameKindOf({ kind }).custom?.settings ?? []))).toEqual([])
  })
})
