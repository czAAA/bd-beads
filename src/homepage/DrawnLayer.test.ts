import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DrawnLayer from './DrawnLayer.vue'
import { LAYERS, TIERS, type Doodle, type SectionName, type Tier } from './drawnLayer'

const SECTIONS: SectionName[] = ['hero', 'inside', 'coffee', 'plans']

describe('DrawnLayer', () => {
  it.each(SECTIONS)('hides the %s layer from assistive tech and the pointer', (section) => {
    const layer = mount(DrawnLayer, { props: { section } }).get('[data-testid="homepage-drawn-layer"]')
    expect(layer.attributes('aria-hidden')).toBe('true')
    expect(layer.element.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0)
  })

  it.each(SECTIONS)("draws every placement of the %s section's layer", (section) => {
    const wrapper = mount(DrawnLayer, { props: { section } })
    const count = (kind: 'marks' | 'doodles') => TIERS.reduce((n, tier) => n + LAYERS[section][kind][tier].length, 0)
    expect(wrapper.findAll('[data-testid="homepage-drawn-mark"]')).toHaveLength(count('marks'))
    expect(wrapper.findAll('[data-testid="homepage-drawn-doodle"]')).toHaveLength(count('doodles'))
  })

  it('keeps the hero and the plans at three to five X1 marks from 1440 up', () => {
    for (const section of ['hero', 'plans'] as const)
      for (const tier of ['xl', 'xxl'] as const) {
        expect(LAYERS[section].marks[tier].length).toBeGreaterThanOrEqual(3)
        expect(LAYERS[section].marks[tier].length).toBeLessThanOrEqual(5)
      }
  })

  // Counted at the edges and in the middle together: tickets 540 and 549 move drawings in beside the content, and a
  // drawing counts wherever it sits.
  describe('how many there are per band (ticket 290)', () => {
    const total = (tier: Tier, kind: 'marks' | 'doodles') =>
      SECTIONS.reduce((n, s) => n + LAYERS[s][kind][tier].length, 0)

    it('keeps the laptop and desktop bands at about thirty drawings and nine or ten X1 marks', () => {
      for (const tier of ['xl', 'xxl'] as const) {
        expect(total(tier, 'doodles')).toBeGreaterThanOrEqual(30)
        expect(total(tier, 'doodles')).toBeLessThanOrEqual(36)
        expect(total(tier, 'marks')).toBeGreaterThanOrEqual(9)
        expect(total(tier, 'marks')).toBeLessThanOrEqual(10)
      }
    })

    it('thins the tablet and small laptop bands to about two thirds, and the phone band to about one third', () => {
      for (const tier of ['md', 'lg'] as const) {
        expect(total(tier, 'doodles')).toBeGreaterThanOrEqual(20)
        expect(total(tier, 'doodles')).toBeLessThanOrEqual(27)
        expect(total(tier, 'marks')).toBeGreaterThanOrEqual(5)
        expect(total(tier, 'marks')).toBeLessThanOrEqual(7)
      }
      expect(total('sm', 'doodles')).toBeGreaterThanOrEqual(7)
      expect(total('sm', 'doodles')).toBeLessThanOrEqual(12)
      expect(total('sm', 'marks')).toBeGreaterThanOrEqual(2)
      expect(total('sm', 'marks')).toBeLessThanOrEqual(4)
    })
  })

  it('sits the drawings a fixed gap of 24-48px outside the column where the wide bands have room', () => {
    for (const section of SECTIONS)
      for (const tier of ['xl', 'xxl'] as const)
        for (const d of LAYERS[section].doodles[tier].filter((d) => !d.big && d.side !== 'center')) {
          // A few small ones tuck into blank space beside the hero's text instead.
          if (d.gap < 0) continue
          expect(d.gap).toBeGreaterThanOrEqual(8)
          expect(d.gap).toBeLessThanOrEqual(48)
        }
    // Most stay outside the column; ticket 549 brought the rest in beside the content.
    const outside = (tier: Tier) =>
      SECTIONS.flatMap((s) => LAYERS[s].doodles[tier]).filter((d) => d.side !== 'center' && d.gap >= 24 && d.gap <= 48).length
    expect(outside('xl')).toBeGreaterThanOrEqual(15)
    expect(outside('xxl')).toBeGreaterThanOrEqual(15)
  })

  it('places each drawing from the column with a gap in CSS', () => {
    const wrapper = mount(DrawnLayer, { props: { section: 'inside' } })
    const first = LAYERS.inside.doodles.md[0]!
    const style = wrapper
      .findAll('[data-testid="homepage-drawn-doodle"]')
      .find((d) => d.classes().includes('drawn__tier--md'))!
      .attributes('style')!
      .replace(/\s/g, '')
    expect(style).toContain(`${first.side === 'left' ? 'right' : 'left'}:calc(50%+var(--col)+${first.gap}px)`)
  })

  it('leaves the large drawings out of the phone band and gives them 16% opacity elsewhere', () => {
    for (const section of SECTIONS) expect(LAYERS[section].doodles.sm.some((d) => d.big)).toBe(false)
    const big = mount(DrawnLayer, { props: { section: 'hero' } })
      .findAll('[data-testid="homepage-drawn-doodle"]')
      .filter((d) => d.classes().includes('drawn__doodle--big'))
    expect(big.length).toBeGreaterThan(0)
    expect(big.every((d) => !d.classes().includes('drawn__tier--sm'))).toBe(true)
  })

  describe('across the whole page (ticket 540)', () => {
    const centred = (tier: Tier) => SECTIONS.flatMap((s) => [...LAYERS[s].doodles[tier], ...LAYERS[s].marks[tier]]).filter((p) => p.side === 'center')

    it('has placements in the gaps between the edges at every band', () => {
      for (const tier of TIERS) expect(centred(tier).length).toBeGreaterThan(0)
    })

    it('measures a centred placement from the middle of the section, not from the column', () => {
      // Measured from the top, and right of the middle: the browser writes a negative gap as `50% - …`.
      const centred = (d: Doodle) => d.side === 'center' && d.top !== undefined && d.gap > 0
      const tier = TIERS.find((t) => LAYERS.plans.doodles[t].some(centred))!
      const placed = LAYERS.plans.doodles[tier].find(centred)!
      const style = mount(DrawnLayer, { props: { section: 'plans' } })
        .findAll('[data-testid="homepage-drawn-doodle"]')
        .find((d) => d.classes().includes(`drawn__tier--${tier}`) && d.attributes('style')!.includes(`calc(50% + ${placed.gap}px)`))!
        .attributes('style')!
        .replace(/\s/g, '')
      expect(style).toContain(`left:calc(50%+${placed.gap}px);top:${placed.top}px`)
      expect(style).not.toContain('--col')
    })
  })

  it('lets only the last section, the Plans, draw into the page padding below it (ticket 549)', () => {
    for (const section of SECTIONS) {
      const layer = mount(DrawnLayer, { props: { section } }).get('[data-testid="homepage-drawn-layer"]')
      expect(layer.classes().includes('drawn--to-page-end')).toBe(section === 'plans')
    }
  })

  it('measures a placement up from the bottom when it gives `bottom`, so it stays under the Plan tiles at any width', () => {
    const tier = TIERS.find((t) => LAYERS.plans.doodles[t].some((d) => d.bottom !== undefined))!
    const placed = LAYERS.plans.doodles[tier].find((d) => d.bottom !== undefined)!
    const styles = mount(DrawnLayer, { props: { section: 'plans' } })
      .findAll('[data-testid="homepage-drawn-doodle"]')
      .filter((d) => d.classes().includes(`drawn__tier--${tier}`))
      .map((d) => d.attributes('style')!.replace(/\s/g, ''))
    const style = styles.find((s) => s.includes(`bottom:${placed.bottom}px`))
    expect(style).toBeDefined()
    expect(style).not.toContain('top:')
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
