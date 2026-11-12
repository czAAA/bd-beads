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

function mountAdjust({ adjusting = true, size = undefined as { beads: string; measure: string } | undefined } = {}) {
  return mount(ReferenceAdjust, { props: { place, aspect: 0.5, limits: { min: 10, max: 400 }, opacity: 50, view, bead: 20, adjusting, size }, attachTo: document.body })
}

const pointer = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, ...extra })

describe('ReferenceAdjust (ReferenceImage card, ticket 0790)', () => {
  it('is a named group, focused as it opens, with four corner handles and a Turn handle', () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    expect(picture.attributes('role')).toBe('group')
    expect(picture.attributes('aria-label')).toBe('Reference image, 50%, turned 0°')
    expect(document.activeElement).toBe(picture.element)
    expect(wrapper.findAll('.reference-adjust__corner').map((corner) => corner.attributes('aria-label'))).toEqual(Object.values(en.referenceImage.corners))
    expect(wrapper.get('[data-testid="reference-adjust-turn"]').attributes('aria-label')).toBe(en.referenceImage.turn)
    wrapper.unmount()
  })

  it('lies where the view draws the picture, in screen px', () => {
    const wrapper = mountAdjust()
    expect(wrapper.get('[data-testid="reference-adjust-picture"]').attributes('style')).toContain('left: 110px; top: 120px; width: 80px; height: 40px')
    wrapper.unmount()
  })

  it('moves a bead with an arrow (ten with Shift), resizes by a tenth with + and −, and turns 15° with [ and ]', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('keydown', { key: 'ArrowRight' })
    await picture.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    await picture.trigger('keydown', { key: '+' })
    await picture.trigger('keydown', { key: ']' })
    await picture.trigger('keydown', { key: '[' })
    const commits = wrapper.emitted('commit')!
    expect(commits[0]).toEqual([{ ...place, x: 70 }, 'Moved'])
    expect(commits[1]).toEqual([{ ...place, y: 250 }, 'Moved'])
    expect(commits[2]![0]).toMatchObject({ width: 44 })
    expect(commits[2]![1]).toBe('Resized')
    expect(commits[3]).toEqual([{ ...place, angle: 15 }, 'Turned 15°'])
    expect(commits[4]).toEqual([{ ...place, angle: 345 }, 'Turned 345°'])
    wrapper.unmount()
  })

  it('draws a drag as it goes and saves it once on release', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointerdown', pointer(110, 120))
    await picture.trigger('pointermove', pointer(130, 120))
    expect(wrapper.emitted('preview')).toEqual([[{ ...place, x: 60 }]])
    expect(wrapper.emitted('commit')).toBeUndefined()
    await picture.trigger('pointerup', pointer(130, 120))
    expect(wrapper.emitted('commit')).toEqual([[{ ...place, x: 60 }, 'Moved']])
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

  it('gives a drag up to a second finger, which pinches the view', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointerdown', pointer(110, 120))
    await picture.trigger('pointermove', pointer(130, 120))
    await picture.trigger('pointerdown', pointer(150, 150, { pointerId: 2 }))
    expect(wrapper.emitted('preview')!.at(-1)).toEqual([place])
    await picture.trigger('pointerup', pointer(130, 120))
    expect(wrapper.emitted('commit')).toBeUndefined()
    wrapper.unmount()
  })

  it('ends on Escape', () => {
    const wrapper = mountAdjust()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('The handles outside Adjust (ticket 0799)', () => {
  it('stand on a shown picture, which is not focused, takes no Tab stop and no outline', () => {
    const wrapper = mountAdjust({ adjusting: false })
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    expect(wrapper.findAll('.reference-adjust__corner')).toHaveLength(4)
    expect(wrapper.find('[data-testid="reference-adjust-turn"]').exists()).toBe(true)
    expect(document.activeElement).not.toBe(picture.element)
    expect(picture.attributes('tabindex')).toBeUndefined()
    expect(picture.classes()).toContain('reference-adjust__picture--handles-only')
    wrapper.unmount()
  })

  it('take the outline and the focus once Adjust opens on them', async () => {
    const wrapper = mountAdjust({ adjusting: false })
    await wrapper.setProps({ adjusting: true })
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    expect(document.activeElement).toBe(picture.element)
    expect(picture.classes()).not.toContain('reference-adjust__picture--handles-only')
    wrapper.unmount()
  })

  it('resize from a corner and turn from the Turn handle', async () => {
    const wrapper = mountAdjust({ adjusting: false })
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
    const wrapper = mountAdjust({ adjusting: false, size: { beads: '28×19 beads', measure: '≈ 4.2 × 2.9 cm · shape kept' } })
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
    const wrapper = mountAdjust({ adjusting: false })
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointerdown', pointer(110, 120))
    await picture.trigger('pointermove', pointer(130, 120))
    await picture.trigger('pointerup', pointer(130, 120))
    await picture.trigger('keydown', { key: 'ArrowRight' })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('preview')).toBeUndefined()
    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.emitted('done')).toBeUndefined()
    wrapper.unmount()
  })
})
