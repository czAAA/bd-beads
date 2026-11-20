import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import ReferenceAdjust from './ReferenceAdjust.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

/** A view at 200%, the grid's first point at (10, 20) on screen. */
const view = { gridToPoint: (x: number, y: number) => ({ x: x * 2 + 10, y: y * 2 + 20 }), viewport: { width: 400, height: 400 } }
const place = { x: 50, y: 50, width: 40, angle: 0 }

interface Mounted {
  size?: { beads: string; measure: string }
  at?: typeof place
  bar?: { left: number; top: number; width: number; height: number }
}

function mountAdjust({ size, at = place, bar }: Mounted = {}) {
  return mount(ReferenceAdjust, { props: { place: at, aspect: 0.5, limits: { min: 10, max: 400 }, opacity: 50, view, size, bar }, attachTo: document.body })
}

const pointer = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, ...extra })

describe('The reference image\'s handles (ReferenceImage card, tickets 0790, 0799, 1118)', () => {
  it('stand on a shown picture as a named group: four corners and a Turn handle, no Tab stop and no outline', () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    expect(picture.attributes('role')).toBe('group')
    expect(picture.attributes('aria-label')).toBe('Reference image, 50%, turned 0°')
    expect(picture.attributes('tabindex')).toBeUndefined()
    expect(document.activeElement).not.toBe(picture.element)
    expect(wrapper.findAll('.reference-adjust__corner').map((corner) => corner.attributes('aria-label'))).toEqual(Object.values(en.referenceImage.corners))
    expect(wrapper.get('[data-testid="reference-adjust-turn"]').attributes('aria-label')).toBe(en.referenceImage.turn)
    wrapper.unmount()
  })

  it('lies where the view draws the picture, in screen px', () => {
    const wrapper = mountAdjust()
    expect(wrapper.get('[data-testid="reference-adjust-picture"]').attributes('style')).toContain('left: 110px; top: 120px; width: 80px; height: 40px')
    wrapper.unmount()
  })

  it('turns from the Turn handle below the picture toward the pointer, snapping to a quarter turn (ticket 0883)', async () => {
    const wrapper = mountAdjust()
    expect(wrapper.get('.reference-adjust__turn').classes()).toContain('reference-adjust__turn--below')
    await wrapper.get('[data-testid="reference-adjust-turn"]').trigger('pointerdown', pointer(110, 200))
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointermove', pointer(10, 118))
    expect(wrapper.get('[data-testid="reference-adjust-angle"]').text()).toBe('90°')
    await picture.trigger('pointerup', pointer(10, 118))
    expect(wrapper.emitted('commit')).toEqual([[{ ...place, angle: 90 }, 'Turned 90°']])
    wrapper.unmount()
  })

  it('gives a corner\'s drag up to a second finger, which pinches the view', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await wrapper.get('[data-testid="reference-adjust-bottom-right"]').trigger('pointerdown', pointer(150, 140))
    await picture.trigger('pointermove', pointer(190, 160))
    await wrapper.get('[data-testid="reference-adjust-top-left"]').trigger('pointerdown', pointer(70, 100, { pointerId: 2 }))
    expect(wrapper.emitted('preview')!.at(-1)).toEqual([place])
    await picture.trigger('pointerup', pointer(190, 160))
    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })

  it('resize from a corner and turn from the Turn handle', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await wrapper.get('[data-testid="reference-adjust-turn"]').trigger('pointerdown', pointer(110, 200))
    await picture.trigger('pointermove', pointer(10, 118))
    await picture.trigger('pointerup', pointer(10, 118))
    await wrapper.get('[data-testid="reference-adjust-bottom-right"]').trigger('pointerdown', pointer(150, 140))
    await picture.trigger('pointermove', pointer(190, 160))
    await picture.trigger('pointerup', pointer(190, 160))
    const commits = wrapper.emitted('commit')!
    expect(commits[0]).toEqual([{ ...place, angle: 90 }, 'Turned 90°'])
    expect(commits[1]![1]).toBe('Resized')
    wrapper.unmount()
  })

  it('show the size chip while a corner is dragged, and say a handle is pressed (ticket 0883)', async () => {
    const wrapper = mountAdjust({ size: { beads: '28×19 beads', measure: '≈ 4.2 × 2.9 cm · shape kept' } })
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    expect(wrapper.find('[data-testid="reference-adjust-size"]').exists()).toBe(false)
    await wrapper.get('[data-testid="reference-adjust-bottom-right"]').trigger('pointerdown', pointer(150, 140))
    await picture.trigger('pointermove', pointer(190, 160))
    expect(wrapper.get('[data-testid="reference-adjust-size"]').text()).toBe('28×19 beads≈ 4.2 × 2.9 cm · shape kept')
    await picture.trigger('pointerup', pointer(190, 160))
    expect(wrapper.find('[data-testid="reference-adjust-size"]').exists()).toBe(false)
    expect(wrapper.emitted('pressing')).toEqual([[true], [false]])
    wrapper.unmount()
  })

  it('leave a press on the picture itself, its keys and Escape to the tools', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointerdown', pointer(110, 120))
    await picture.trigger('pointermove', pointer(130, 120))
    await picture.trigger('pointerup', pointer(130, 120))
    await picture.trigger('keydown', { key: 'ArrowRight' })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('preview')).toBeUndefined()
    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })

  it('stands the Turn handle on beyond the picture bar where it would land under it (ticket 1160)', () => {
    // Turned bottom edge up: the handle's 48px would put it at (110, 52), under the bar over the picture's top.
    const turned = { ...place, angle: 180 }
    const bar = { left: 40, top: 46, width: 140, height: 40 }
    const wrapper = mountAdjust({ at: turned, bar })
    expect(wrapper.get('.reference-adjust__turn').classes()).toContain('reference-adjust__turn--below')
    expect(wrapper.get('.reference-adjust__stem').attributes('style')).toContain('calc(76px - var(--reference-turn) / 2)')
    wrapper.unmount()
    // Upright, the handle below the picture is nowhere near the bar: its own 48px.
    const upright = mountAdjust({ bar })
    expect(upright.get('.reference-adjust__stem').attributes('style')).toContain('calc(48px - var(--reference-turn) / 2)')
    upright.unmount()
  })

  it('stands the Turn handle on the picture\'s other edge where there is no room beyond the bar (ticket 1160)', () => {
    // The same picture 15px higher: beyond the bar is above the canvas box, so the handle takes the edge that faces down.
    const wrapper = mountAdjust({ at: { ...place, y: 35, angle: 180 }, bar: { left: 40, top: 16, width: 140, height: 40 } })
    expect(wrapper.get('.reference-adjust__turn').classes()).not.toContain('reference-adjust__turn--below')
    expect(wrapper.get('.reference-adjust__stem').attributes('style')).toContain('calc(48px - var(--reference-turn) / 2)')
    wrapper.unmount()
  })

  it('keeps the Turn handle on its side through a drag, though the drag takes it out of the canvas box (ticket 1160)', async () => {
    // Near the left edge: turned a quarter, the handle is past it. It stays the handle being dragged, the picture under it.
    const wrapper = mountAdjust({ at: { ...place, x: 20 } })
    await wrapper.get('[data-testid="reference-adjust-turn"]').trigger('pointerdown', pointer(50, 188))
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointermove', pointer(0, 120))
    await picture.trigger('pointermove', pointer(0, 121))
    expect(wrapper.emitted('preview')!.map(([at]) => (at as typeof place).angle)).toEqual([90, 90])
    expect(wrapper.get('.reference-adjust__turn').classes()).toContain('reference-adjust__turn--below')
    wrapper.unmount()
  })
})
