import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLINT_COLOR, ROW_MOTION, easeStandard, glintMs, glintWash } from './rowMotion'

const css = readFileSync(resolve(__dirname, '../../src/styles/design-values.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
/** Every value a custom property is given in design-values.css, in order: one per theme block that sets it. */
const valuesOf = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map(([, value]) => value.trim())
const ms = (name: string) => parseFloat(valuesOf(name)[0]!)

describe('Row progress motion (ticket 0730)', () => {
  it('keeps the canvas’s values equal to their CSS twins', () => {
    expect(ROW_MOTION.glint).toBe(ms('--row-glint-duration'))
    expect(ROW_MOTION.glintStep).toBe(ms('--row-glint-step'))
    expect(ROW_MOTION.glintSpan).toBe(ms('--row-glint-span'))
    expect(ROW_MOTION.glintPeak).toBe(ms('--row-glint-peak'))
    expect(ROW_MOTION.dimDelay).toBe(ms('--row-dim-delay'))
    expect(ROW_MOTION.glide).toBe(ms('--duration-base'))
    expect(ROW_MOTION.patternDoneDelay).toBe(ms('--pattern-done-delay'))
    expect(ROW_MOTION.restoreDelay).toBe(ms('--pattern-done-shimmer-delay'))
    expect(ROW_MOTION.restore).toBe(ms('--pattern-done-restore'))
    expect(ROW_MOTION.starsDelay).toBe(ms('--pattern-done-stars-delay'))
    expect(ROW_MOTION.starStep).toBe(ms('--pattern-done-star-step'))
    expect(ROW_MOTION.star).toBe(ms('--pattern-done-star'))
    // White in every theme.
    expect(valuesOf('--row-glint')).toEqual([GLINT_COLOR, GLINT_COLOR, GLINT_COLOR])
  })

  it('glints a long pass so its last bead starts within the span, and washes each bead up to the peak and back', () => {
    expect(glintMs(10)).toBe(9 * ROW_MOTION.glintStep + ROW_MOTION.glint)
    expect(glintMs(200)).toBeCloseTo(ROW_MOTION.glintSpan + ROW_MOTION.glint)
    expect(glintWash(0, 0, 10)).toBe(0)
    expect(glintWash(0.35 * ROW_MOTION.glint, 0, 10)).toBeCloseTo(ROW_MOTION.glintPeak)
    expect(glintWash(ROW_MOTION.glint, 0, 10)).toBe(0)
    // The second bead starts a step later.
    expect(glintWash(ROW_MOTION.glintStep, 1, 10)).toBe(0)
    expect(glintWash(ROW_MOTION.glintStep + 0.35 * ROW_MOTION.glint, 1, 10)).toBeCloseTo(ROW_MOTION.glintPeak)
  })

  it('eases as the design system’s standard curve does: quick out of the start, slow into the end', () => {
    expect(easeStandard(0)).toBe(0)
    expect(easeStandard(1)).toBe(1)
    expect(easeStandard(0.5)).toBeGreaterThan(0.8)
  })
})
