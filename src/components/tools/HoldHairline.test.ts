import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HoldHairline from './HoldHairline.vue'
import { RADIAL_HOLE } from '../../domain/radialToolbox'

describe('HoldHairline (ticket 1065)', () => {
  it('draws nothing while no hold is timed', () => {
    expect(mount(HoldHairline).find('[data-testid="hold-hairline"]').exists()).toBe(false)
  })

  it('draws one circle round the pressed point, where the ring\'s hole will be, starting at the top', () => {
    const hairline = mount(HoldHairline, { props: { at: { x: 300, y: 200 } } }).get('[data-testid="hold-hairline"]')

    expect(hairline.attributes('style')).toContain('left: 300px')
    expect(hairline.attributes('style')).toContain('top: 200px')
    expect(hairline.attributes('aria-hidden')).toBe('true')
    const line = hairline.get('circle')
    expect(line.attributes('r')).toBe(String(RADIAL_HOLE))
    // A circle starts at 3 o'clock and runs clockwise: turned back a quarter it starts straight up.
    expect(line.attributes('transform')).toBe('rotate(-90)')
  })
})
