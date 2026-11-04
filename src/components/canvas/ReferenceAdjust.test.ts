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

function mountAdjust() {
  return mount(ReferenceAdjust, { props: { place, aspect: 0.5, limits: { min: 10, max: 400 }, opacity: 50, view, bead: 20 }, attachTo: document.body })
}

const pointer = (_type: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, ...extra })

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
    await picture.trigger('pointerdown', pointer('pointerdown', 110, 120))
    await picture.trigger('pointermove', pointer('pointermove', 130, 120))
    expect(wrapper.emitted('preview')).toEqual([[{ ...place, x: 60 }]])
    expect(wrapper.emitted('commit')).toBeUndefined()
    await picture.trigger('pointerup', pointer('pointerup', 130, 120))
    expect(wrapper.emitted('commit')).toEqual([[{ ...place, x: 60 }, 'Moved']])
    wrapper.unmount()
  })

  it('turns from the Turn handle toward the pointer, snapping to a quarter turn', async () => {
    const wrapper = mountAdjust()
    await wrapper.get('[data-testid="reference-adjust-turn"]').trigger('pointerdown', pointer('pointerdown', 110, 40))
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointermove', pointer('pointermove', 210, 122))
    expect(wrapper.get('[data-testid="reference-adjust-angle"]').text()).toBe('90°')
    await picture.trigger('pointerup', pointer('pointerup', 210, 122))
    expect(wrapper.emitted('commit')).toEqual([[{ ...place, angle: 90 }, 'Turned 90°']])
    wrapper.unmount()
  })

  it('gives a drag up to a second finger, which pinches the view', async () => {
    const wrapper = mountAdjust()
    const picture = wrapper.get('[data-testid="reference-adjust-picture"]')
    await picture.trigger('pointerdown', pointer('pointerdown', 110, 120))
    await picture.trigger('pointermove', pointer('pointermove', 130, 120))
    await picture.trigger('pointerdown', pointer('pointerdown', 150, 150, { pointerId: 2 }))
    expect(wrapper.emitted('preview')!.at(-1)).toEqual([place])
    await picture.trigger('pointerup', pointer('pointerup', 130, 120))
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
