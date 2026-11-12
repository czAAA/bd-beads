import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeResizeObserver } from '../../testUtils/fakeResizeObserver'
import ReferencePictureBar from './ReferencePictureBar.vue'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

/** A view at 200%, the grid's first point at (10, 20) on screen. */
const view = { gridToPoint: (x: number, y: number) => ({ x: x * 2 + 10, y: y * 2 + 20 }), viewport: { width: 400, height: 400 } }
const place = { x: 50, y: 50, width: 40, angle: 0 }

function mountBar(props: Record<string, unknown> = {}) {
  return mount(ReferencePictureBar, {
    props: { place, picture: { left: 70, top: 100, width: 80, height: 40 }, barHeight: 40, view, bead: 20, opacity: 50, frameBody: 'A 4×2 Frame where the picture lies.', convertBody: 'Turns the picture into 4×2 beads.', converting: false, ...props },
    attachTo: document.body,
  })
}

const pointer = (x: number, y: number) => ({ clientX: x, clientY: y, button: 0, pointerId: 1 })

describe('ReferencePictureBar (ReferenceImage card, ticket 0883)', () => {
  it('is one toolbar named Reference image, one Tab stop', () => {
    const wrapper = mountBar()
    const bar = wrapper.get('[data-testid="picture-bar"]')
    expect(bar.attributes('role')).toBe('toolbar')
    expect(bar.attributes('aria-label')).toBe('Reference image')
    expect(wrapper.findAll('.picture-bar__item').filter((item) => item.attributes('tabindex') === '0')).toHaveLength(1)
    wrapper.unmount()
  })

  it('moves the picture with the Move grip, drawn as it goes and saved once on release, and a bead with an arrow', async () => {
    const wrapper = mountBar()
    const grip = wrapper.get('[data-testid="picture-bar-move"]')
    await grip.trigger('pointerdown', pointer(100, 60))
    await grip.trigger('pointermove', pointer(120, 60))
    expect(wrapper.emitted('preview')).toEqual([[{ ...place, x: 60 }]])
    await grip.trigger('pointerup', pointer(120, 60))
    await grip.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('commit')).toEqual([
      [{ ...place, x: 60 }, 'Moved'],
      [{ ...place, x: 70 }, 'Moved'],
    ])
    wrapper.unmount()
  })

  it('opens Opacity, Replace and Remove in place from ···, which turns into Close', async () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="picture-bar-opacity"]').exists()).toBe(false)
    await wrapper.get('[data-testid="picture-bar-more"]').trigger('click')
    expect(wrapper.get('[data-testid="picture-bar-more"]').attributes('aria-label')).toBe('Close')
    await wrapper.get('[data-testid="picture-bar-opacity"] [role="radio"]:last-child').trigger('click')
    expect(wrapper.emitted('opacity')).toEqual([[100]])
    await wrapper.get('[data-testid="picture-bar-remove"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.find('[data-testid="picture-bar-opacity"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('previews the Frame on hover, sets it on a press, and holds Convert to beads off with its reason', async () => {
    const wrapper = mountBar({ convertOff: 'The picture is too small to bead. Make it bigger first.' })
    const frame = wrapper.get('[data-testid="picture-bar-frame"]')
    await frame.trigger('mouseenter')
    await frame.trigger('click')
    await frame.trigger('mouseleave')
    expect(wrapper.emitted('frame-preview')).toEqual([[true], [false]])
    expect(wrapper.emitted('frame')).toHaveLength(1)
    const convert = wrapper.get('[data-testid="picture-bar-convert"]')
    expect(convert.attributes('aria-disabled')).toBe('true')
    await convert.trigger('click')
    expect(wrapper.emitted('convert')).toBeUndefined()
    wrapper.unmount()
  })
})
