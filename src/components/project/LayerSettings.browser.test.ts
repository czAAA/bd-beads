import { describe, expect, it } from 'vitest'
import { findBead } from '../../domain/beads'
import { mountAt } from '../../testUtils/browserFit'
import { emulateTouch, hitAreaProblems } from '../../testUtils/hitAreas'
import { tokenPx } from '../../testUtils/tokenPx'
import LayerSettings from './LayerSettings.vue'

// Technique, Drop, Bead and Background are the field labels of one section and read as one (ticket 0992): `control`
// type in `ink`, none with an icon, so no field's name looks like the section header above it.
const props = { layer: 'frame', technique: 'brick', techniqueSettings: { brickDrop: 3 }, bead: findBead('miyuki/delica/11-0'), background: 1, testid: 'x' }

describe('LayerSettings field labels', () => {
  it('writes the four field labels in one type style, without icons', async () => {
    const { root } = await mountAt(LayerSettings, props, { locale: 'en', width: 390 })
    const groupLabel = (testid: string) => document.getElementById(root.querySelector(`[data-testid="${testid}"]`)!.closest('[role="group"][aria-labelledby]')!.getAttribute('aria-labelledby')!)!
    const labels = [
      root.querySelector('[data-testid="x-technique"] .panel-picker__label')!,
      root.querySelector('[data-testid="x-brick-drop"] .setting-stepper__head > span')!,
      groupLabel('bead-section'),
      groupLabel('frame-background-section'),
    ]
    const styles = labels.map((label) => {
      const style = getComputedStyle(label)
      return { font: `${style.fontFamily} ${style.fontSize} ${style.fontWeight}`, color: style.color, transform: style.textTransform }
    })
    expect(styles).toEqual(styles.map(() => styles[0]))
    expect(styles[0]!.font).toMatch(/Inter/)
    expect(labels.every((label) => !label.querySelector('svg'))).toBe(true)
  })
})

// On touch the Drop stepper's number and the Background swatches take a finger (ticket 0962): −, the number and + each
// answer across `touch-target`, none over another; each swatch is the Palette's chip size, its own hit area, apart from
// the next (responsive.md).
describe('LayerSettings on touch (ticket 0962)', () => {
  it('gives the Drop stepper’s −, number and + a touch-target hit area each, and every Background swatch the Palette’s chip size', async () => {
    await emulateTouch()
    const { root } = await mountAt(LayerSettings, props, { locale: 'en', width: 390 })
    const one = (selector: string) => root.querySelector(selector)!
    const stepper = { less: one('[data-testid="x-brick-drop-less"]'), value: one('[data-testid="x-brick-drop-value"] button'), more: one('[data-testid="x-brick-drop-more"]') }
    expect(hitAreaProblems(stepper, tokenPx(document.body, '--touch-target'))).toEqual([])
    const swatches = [...root.querySelectorAll('[data-background-swatch], [data-testid="custom-color-button"]')]
    expect(swatches.length).toBeGreaterThan(2)
    expect(hitAreaProblems(Object.fromEntries(swatches.map((swatch, index) => [`swatch ${index}`, swatch])), tokenPx(document.body, '--swatch-touch-min'))).toEqual([])
  })
})
