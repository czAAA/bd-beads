import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DrawnLayer from './DrawnLayer.vue'
import { LAYERS, TIERS, type SectionName } from './drawnLayer'

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

  it('keeps the hero and the plans at three to five X1 marks from 1024 up', () => {
    for (const section of ['hero', 'plans'] as const)
      for (const tier of ['lg', 'xl', 'xxl'] as const) {
        expect(LAYERS[section].marks[tier].length).toBeGreaterThanOrEqual(3)
        expect(LAYERS[section].marks[tier].length).toBeLessThanOrEqual(5)
      }
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
