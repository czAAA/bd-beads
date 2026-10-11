import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DrawnLayer from './DrawnLayer.vue'
import { LAYERS, TIERS, type SectionName, type Tier } from './drawnLayer'

const SECTIONS: SectionName[] = ['hero', 'inside', 'coffee', 'plans']

describe('DrawnLayer', () => {
  it.each(SECTIONS)('hides the %s layer from assistive tech and the pointer', (section) => {
    const layer = mount(DrawnLayer, { props: { section } }).get('[data-testid="overview-drawn-layer"]')
    expect(layer.attributes('aria-hidden')).toBe('true')
    expect(layer.element.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
  })

  it.each(SECTIONS)("draws every placement of the %s section's layer", (section) => {
    const wrapper = mount(DrawnLayer, { props: { section } })
    const count = (kind: 'marks' | 'doodles') => TIERS.reduce((n, tier) => n + LAYERS[section][kind][tier].length, 0)
    expect(wrapper.findAll('[data-testid="overview-drawn-mark"]')).toHaveLength(count('marks'))
    expect(wrapper.findAll('[data-testid="overview-drawn-doodle"]')).toHaveLength(count('doodles'))
  })

  it('keeps the hero and the plans at three to five X1 marks from 1440 up', () => {
    for (const section of ['hero', 'plans'] as const)
      for (const tier of ['xl', 'xxl'] as const) {
        expect(LAYERS[section].marks[tier].length).toBeGreaterThanOrEqual(3)
        expect(LAYERS[section].marks[tier].length).toBeLessThanOrEqual(5)
      }
  })

  describe('how many there are per band (ticket 290)', () => {
    const total = (tier: Tier, kind: 'marks' | 'doodles') =>
      SECTIONS.reduce((n, s) => n + LAYERS[s][kind][tier].length, 0)

    it('keeps the laptop and desktop bands as they were', () => {
      for (const tier of ['xl', 'xxl'] as const) {
        expect(total(tier, 'doodles')).toBe(24)
        expect(total(tier, 'marks')).toBe(9)
      }
    })

    it('thins the tablet and small laptop bands to about two thirds, and the phone band to about one third', () => {
      for (const tier of ['md', 'lg'] as const) {
        expect(total(tier, 'doodles')).toBeGreaterThanOrEqual(14)
        expect(total(tier, 'doodles')).toBeLessThanOrEqual(18)
        expect(total(tier, 'marks')).toBeGreaterThanOrEqual(5)
        expect(total(tier, 'marks')).toBeLessThanOrEqual(7)
      }
      expect(total('sm', 'doodles')).toBeGreaterThanOrEqual(6)
      expect(total('sm', 'doodles')).toBeLessThanOrEqual(10)
      expect(total('sm', 'marks')).toBeGreaterThanOrEqual(2)
      expect(total('sm', 'marks')).toBeLessThanOrEqual(4)
    })
  })

  it('sits the drawings a fixed gap of 24-48px outside the column where the wide bands have room', () => {
    for (const section of SECTIONS)
      for (const tier of ['xl', 'xxl'] as const)
        for (const d of LAYERS[section].doodles[tier].filter((d) => !d.big)) {
          // A few small ones tuck into blank space beside the hero's text instead.
          if (d.gap < 0) continue
          expect(d.gap).toBeGreaterThanOrEqual(8)
          expect(d.gap).toBeLessThanOrEqual(48)
        }
    const outside = (tier: Tier) =>
      SECTIONS.flatMap((s) => LAYERS[s].doodles[tier]).filter((d) => d.gap >= 24 && d.gap <= 48).length
    expect(outside('xl')).toBeGreaterThanOrEqual(18)
    expect(outside('xxl')).toBeGreaterThanOrEqual(18)
  })

  it('places each drawing from the column with a gap in CSS', () => {
    const wrapper = mount(DrawnLayer, { props: { section: 'inside' } })
    const first = LAYERS.inside.doodles.md[0]!
    const style = wrapper
      .findAll('[data-testid="overview-drawn-doodle"]')
      .find((d) => d.classes().includes('drawn__tier--md'))!
      .attributes('style')!
      .replace(/\s/g, '')
    expect(style).toContain(`${first.side === 'left' ? 'right' : 'left'}:calc(50%+var(--col)+${first.gap}px)`)
  })

  it('leaves the large drawings out of the phone band and gives them 16% opacity elsewhere', () => {
    for (const section of SECTIONS) expect(LAYERS[section].doodles.sm.some((d) => d.big)).toBe(false)
    const big = mount(DrawnLayer, { props: { section: 'hero' } })
      .findAll('[data-testid="overview-drawn-doodle"]')
      .filter((d) => d.classes().includes('drawn__doodle--big'))
    expect(big.length).toBeGreaterThan(0)
    expect(big.every((d) => !d.classes().includes('drawn__tier--sm'))).toBe(true)
  })

  it('colours the beads from the Palette and the accent/muted tokens only', () => {
    const fills = SECTIONS.flatMap((section) =>
      mount(DrawnLayer, { props: { section } })
        .findAll('rect')
        .map((r) => r.attributes('fill')),
    )
    expect(fills.every((f) => /^#[0-9a-f]{6}$/.test(f!) || f === 'var(--accent)' || f === 'var(--muted)')).toBe(true)
  })
})
