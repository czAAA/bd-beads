import { describe, expect, it } from 'vitest'
import { findBead } from '../../domain/beads'
import { mountAt } from '../../testUtils/browserFit'
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
