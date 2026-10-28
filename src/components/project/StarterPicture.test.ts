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

    await wrapper.setProps({ choice: { sizes: { partSize: 7 }, useDesign: true } })
    await wrapper.setProps({ choice: { sizes: { partSize: 7 }, useDesign: false } })

    expect(canvas.renders()).toBeGreaterThan(before + 1)
  })

  it('draws a pair of earrings and a Band standing upright, each picture twice as wide or as tall as it is drawn once', () => {
    installFakeCanvas()
    const shown = (props: InstanceType<typeof StarterPicture>['$props']) => {
      const canvas = mount(StarterPicture, { props }).get('canvas').element as HTMLCanvasElement
      return { width: canvas.width, height: canvas.height }
    }
    const earring = shown({ starter: starterById('vFringe') })
    const pair = shown({ starter: starterById('vFringe'), pair: true })
    expect(pair.width / pair.height).toBeGreaterThan((2 * earring.width) / earring.height)
    const band = shown({ starter: starterById('bandStripes') })
    const upright = shown({ starter: starterById('bandStripes'), upright: true })
    expect(band.width).toBeGreaterThan(band.height)
    expect(upright.height).toBeGreaterThan(upright.width)
    expect(shown({ starter: starterById('ringStripes'), upright: true }).width).toBeGreaterThan(shown({ starter: starterById('ringStripes'), upright: true }).height)
  })
})
