import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RadialToolbox from './RadialToolbox.vue'
import { RADIAL_PLACES, RADIAL_RING } from '../../domain/radialToolbox'

const RECENTS = ['#1f77b4', '#2ca02c', '#ff7f0e']
const CENTER = { x: 400, y: 300 }
const base = { open: true, center: CENTER, activeTool: 'paint', canUndo: true, canRedo: true, recents: RECENTS, beadHex: '#e63746' } as const

const mountRing = (props: Record<string, unknown> = {}) => mount(RadialToolbox, { props: { ...base, ...props }, attachTo: document.body })
type Ring = ReturnType<typeof mountRing>
const item = (wrapper: Ring, id: string) => wrapper.get(`[data-testid="radial-${id}"]`)
const off = (wrapper: Ring, id: string) => item(wrapper, id).attributes('aria-disabled') === 'true'

/** Moves a mouse over the ring `distance` px from its centre at `angle`, degrees clockwise from straight up. */
function hover(wrapper: Ring, angle: number, distance: number = RADIAL_RING.radius, pointerType = 'mouse') {
  const radians = (angle * Math.PI) / 180
  return wrapper.get('[data-testid="radial-toolbox"]').trigger('pointermove', { clientX: CENTER.x + distance * Math.sin(radians), clientY: CENTER.y - distance * Math.cos(radians), pointerType })
}

describe('RadialToolbox (ticket 1064)', () => {
  let wrapper: Ring | undefined

  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('is a toolbar named Tools holding the ten items, each a button with its existing control\'s name', () => {
    wrapper = mountRing()
    const ring = wrapper.get('[data-testid="radial-toolbox"]')
    expect(ring.attributes('role')).toBe('toolbar')
    expect(ring.attributes('aria-label')).toBe('Tools')
    expect(wrapper.findAll('button').map((button) => [button.attributes('data-radial-item'), button.attributes('aria-label')])).toEqual([
      ['pick-color', 'Pick color from Canvas'],
      ['recent-1', 'Recent 1, Paint with #1f77b4'],
      ['recent-2', 'Recent 2, Paint with #2ca02c'],
      ['recent-3', 'Recent 3, Paint with #ff7f0e'],
      ['redo', 'Redo'],
      ['tool-erase', 'Eraser'],
      ['tool-select', 'Select'],
      ['tool-fill', 'Fill'],
      ['tool-paint', 'Paint'],
      ['undo', 'Undo'],
    ])
  })

  it('stands centred on the point it is given, each item at its place\'s angle, with a divider on each side of Undo and Redo', () => {
    wrapper = mountRing()
    const ring = wrapper.get<HTMLElement>('[data-testid="radial-toolbox"]')
    expect([ring.element.style.left, ring.element.style.top]).toEqual(['400px', '300px'])
    for (const place of RADIAL_PLACES) {
      const tile = item(wrapper, place.id).element.closest<HTMLElement>('.radial-toolbox__place')!
      expect(tile.style.getPropertyValue('--radial-angle'), place.id).toBe(`${place.angle}deg`)
    }
    expect(wrapper.findAll('.radial-toolbox__divider').map((divider) => divider.attributes('transform'))).toEqual(['rotate(68)', 'rotate(112)', 'rotate(248)', 'rotate(292)'])
  })

  it('draws the tools and history with their controls\' icons, Pick color as the plain eyedropper, and no hotkey digit', () => {
    wrapper = mountRing()
    const icon = (id: string) => item(wrapper!, id).get('svg.icon').attributes('data-icon')
    expect(['tool-paint', 'tool-fill', 'tool-select', 'tool-erase', 'undo', 'redo', 'pick-color'].map(icon)).toEqual(['paint', 'fill', 'select', 'erase', 'undo', 'redo', 'eyedropper'])
    expect(wrapper.find('.icon-btn__key').exists()).toBe(false)
  })

  it('presses the active tool and no other, and none when no tool is lit', async () => {
    wrapper = mountRing({ activeTool: 'select' })
    const pressed = () => RADIAL_PLACES.filter((place) => item(wrapper!, place.id).attributes('aria-pressed') === 'true').map((place) => place.id)
    expect(pressed()).toEqual(['tool-select'])
    expect(item(wrapper, 'tool-select').classes()).toEqual(expect.arrayContaining(['icon-btn--selected', 'icon-btn--accent']))
    // Undo, Redo and the colours are not toggles.
    for (const id of ['undo', 'redo', 'pick-color', 'recent-1']) expect(item(wrapper, id).attributes('aria-pressed'), id).toBeUndefined()

    await wrapper.setProps({ activeTool: undefined })
    expect(pressed()).toEqual([])
  })

  it('turns Undo, Redo and Pick color off when they cannot run', async () => {
    wrapper = mountRing()
    expect(RADIAL_PLACES.filter((place) => off(wrapper!, place.id))).toEqual([])

    await wrapper.setProps({ canUndo: false, canRedo: false, beadHex: null })
    expect(RADIAL_PLACES.filter((place) => off(wrapper!, place.id)).map((place) => place.id)).toEqual(['pick-color', 'redo', 'undo'])
  })

  it('keeps the place of a recent colour that does not exist yet as a dashed ring that is off', () => {
    wrapper = mountRing({ recents: ['#1f77b4'] })
    expect(item(wrapper, 'recent-1').get('.radial-toolbox__swatch').classes()).not.toContain('radial-toolbox__swatch--missing')
    for (const id of ['recent-2', 'recent-3']) {
      expect(off(wrapper, id), id).toBe(true)
      expect(item(wrapper, id).attributes('aria-label')).toBe(`Recent ${id.at(-1)}`)
      expect(item(wrapper, id).get('.radial-toolbox__swatch').classes()).toContain('radial-toolbox__swatch--missing')
    }
  })

  it('emits each item\'s own control\'s event on a click', async () => {
    wrapper = mountRing()
    for (const id of ['tool-paint', 'tool-fill', 'tool-select', 'tool-erase', 'recent-1', 'recent-3', 'pick-color', 'undo', 'redo']) await item(wrapper, id).trigger('click')
    expect(wrapper.emitted('select-tool')).toEqual([['paint'], ['fill'], ['select'], ['erase']])
    expect(wrapper.emitted('pick-recent')).toEqual([['#1f77b4'], ['#ff7f0e']])
    expect(wrapper.emitted('pick-color')).toHaveLength(1)
    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.emitted('redo')).toHaveLength(1)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('emits nothing for an item that is off', async () => {
    wrapper = mountRing({ canUndo: false, canRedo: false, beadHex: null, recents: [] })
    for (const id of ['undo', 'redo', 'pick-color', 'recent-1', 'recent-2', 'recent-3']) await item(wrapper, id).trigger('click')
    expect(Object.keys(wrapper.emitted()).filter((name) => name !== 'click')).toEqual([])
  })

  it('shows the hover look and the name of the item a mouse is over, at once, and neither once it leaves', async () => {
    wrapper = mountRing()
    const under = () => wrapper!.findAll('.radial-toolbox__place--under').map((place) => place.get('button').attributes('data-radial-item'))
    expect(wrapper.find('[data-testid="radial-name"]').exists()).toBe(false)

    await hover(wrapper, 129)
    expect(under()).toEqual(['tool-erase'])
    expect(wrapper.get('[data-testid="radial-name"]').text()).toBe('Eraser')
    expect(wrapper.get('[data-testid="radial-name"] strong').text()).toBe('Eraser')

    // Anywhere in the slice, not only on the tile.
    await hover(wrapper, 270 + 20, 105)
    expect(under()).toEqual(['undo'])

    await wrapper.get('[data-testid="radial-toolbox"]').trigger('pointerleave')
    expect(under()).toEqual([])
    expect(wrapper.find('[data-testid="radial-name"]').exists()).toBe(false)
  })

  it('writes a recent colour\'s hex and the pressed bead\'s hex after the name', async () => {
    wrapper = mountRing()
    await hover(wrapper, 17)
    expect(wrapper.get('[data-testid="radial-name"] strong').text()).toBe('Recent 2')
    expect(wrapper.get('.radial-toolbox__name-meta').text()).toBe('#2ca02c')

    await hover(wrapper, 309)
    expect(wrapper.get('[data-testid="radial-name"] strong').text()).toBe('Pick color from Canvas')
    expect(wrapper.get('.radial-toolbox__name-meta').text()).toBe('#e63746')
  })

  it('names an item that is off without its hover look, and a finger has no hover', async () => {
    wrapper = mountRing({ canUndo: false })
    await hover(wrapper, 270)
    expect(wrapper.get('[data-testid="radial-name"]').text()).toBe('Undo')
    expect(wrapper.findAll('.radial-toolbox__place--under')).toHaveLength(0)

    await wrapper.get('[data-testid="radial-toolbox"]').trigger('pointerleave')
    await hover(wrapper, 129, RADIAL_RING.radius, 'touch')
    expect(wrapper.find('[data-testid="radial-name"]').exists()).toBe(false)
  })

  it('shows the item under a held pointer pressed, with its name', () => {
    wrapper = mountRing({ held: 'tool-fill' })
    expect(wrapper.findAll('.radial-toolbox__place--held').map((place) => place.get('button').attributes('data-radial-item'))).toEqual(['tool-fill'])
    expect(wrapper.get('[data-testid="radial-name"]').text()).toBe('Fill')
  })

  it('is hidden while closed, and Escape asks to close it only while it is open', async () => {
    wrapper = mountRing()
    expect(wrapper.get('[data-testid="radial-toolbox"]').isVisible()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.setProps({ open: false })
    expect(wrapper.get('[data-testid="radial-toolbox"]').isVisible()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('a press outside it asks to close it and is swallowed; a press on it is not', async () => {
    wrapper = mountRing()
    const outside = document.createElement('button')
    document.body.append(outside)
    let heard = 0
    outside.addEventListener('pointerdown', () => (heard += 1))

    item(wrapper, 'tool-fill').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toBeUndefined()

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(heard).toBe(0)
    outside.remove()
  })

  it('keeps the picked tile pressed while the ring leaves, and none after a pick that keeps it open', async () => {
    wrapper = mountRing()
    const picked = () => wrapper!.findAll('.radial-toolbox__place--picked').map((place) => place.get('button').attributes('data-radial-item'))

    await item(wrapper, 'undo').trigger('click')
    await wrapper.vm.$nextTick()
    expect(picked()).toEqual([])

    // The click and the close it brings land in one tick, as when the flow closes the ring.
    void item(wrapper, 'tool-erase').trigger('click')
    await wrapper.setProps({ open: false })
    expect(picked()).toEqual(['tool-erase'])

    await wrapper.setProps({ open: true })
    expect(picked()).toEqual([])
  })
})
