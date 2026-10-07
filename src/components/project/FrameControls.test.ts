import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameControls from './FrameControls.vue'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

describe('FrameControls', () => {
  it('shows the Estimated size warning as an always-visible Note, with no (i) button (ticket 328)', () => {
    const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 15, unit: 'mm' } })
    const wrapper = mount(FrameControls, { props: { project } })

    expect(wrapper.find('[data-testid="size-estimate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="size-estimate-note"]').text()).toBe(en.size.estimateWarning)
    expect(wrapper.find('[data-testid="size-estimate-info"]').exists()).toBe(false)
  })
})
