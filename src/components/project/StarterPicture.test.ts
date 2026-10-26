import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StarterPicture from './StarterPicture.vue'
import { installFakeCanvas } from '../../testUtils/fakeCanvas'

afterEach(() => vi.restoreAllMocks())

const props = { technique: 'loom', columns: 24, rows: 80, seedText: 'gerdan' } as const

describe('the Starter picture', () => {
  it('draws the sample with the Project renderer and hides it from screen readers', () => {
    const canvas = installFakeCanvas()
    const wrapper = mount(StarterPicture, { props })

    expect(canvas.renders()).toBeGreaterThan(0)
    expect(wrapper.get('canvas').attributes('aria-hidden')).toBe('true')
  })

  it('draws again when the Technique changes', async () => {
    const canvas = installFakeCanvas()
    const wrapper = mount(StarterPicture, { props })
    const before = canvas.renders()

    await wrapper.setProps({ technique: 'peyote' })

    expect(canvas.renders()).toBeGreaterThan(before)
  })
})
