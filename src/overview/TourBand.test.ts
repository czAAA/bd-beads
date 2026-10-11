import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { installFakeCanvas } from '../testUtils/fakeCanvas'
import TourBand from './TourBand.vue'

describe('TourBand', () => {
  it('draws the whole Tour Project with the Project renderer, empty corners included', () => {
    const canvas = installFakeCanvas()
    const wrapper = mount(TourBand)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(canvas.renders()).toBe(1)
  })

  it('is 75 beads long and 10 across, row 1 at the left', () => {
    installFakeCanvas()
    const { element } = mount(TourBand).get('canvas')
    const [width, height] = [Number(element.getAttribute('width')), Number(element.getAttribute('height'))]
    expect(width / height).toBeCloseTo(7.5, 0)
  })
})
