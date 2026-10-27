import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StarterPicture from './StarterPicture.vue'
import { starterById } from '../../domain/starters'
import { installFakeCanvas } from '../../testUtils/fakeCanvas'

afterEach(() => vi.restoreAllMocks())

describe('the Starter picture', () => {
  it('draws the design with the Project renderer and hides it from screen readers', () => {
    const canvas = installFakeCanvas()
    const wrapper = mount(StarterPicture, { props: { starter: starterById('star') } })

    expect(canvas.renders()).toBeGreaterThan(0)
    expect(wrapper.get('canvas').attributes('aria-hidden')).toBe('true')
  })

  it('draws again when the size or the design changes', async () => {
    const canvas = installFakeCanvas()
    const wrapper = mount(StarterPicture, { props: { starter: starterById('star') } })
    const before = canvas.renders()

    await wrapper.setProps({ size: 7 })
    await wrapper.setProps({ design: false })

    expect(canvas.renders()).toBeGreaterThan(before + 1)
  })
})
