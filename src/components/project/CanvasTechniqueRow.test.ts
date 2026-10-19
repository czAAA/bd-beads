import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CanvasTechniqueRow from './CanvasTechniqueRow.vue'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

describe('CanvasTechniqueRow', () => {
  it.each(['loom', 'rightAngle', 'netting'] as const)('offers all five Techniques on a Canvas woven in %s (ticket 507)', (technique) => {
    const project = createProject({ technique, netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 6, height: 6, unit: 'beads' } })
    const wrapper = mount(CanvasTechniqueRow, { props: { project } })
    const options = wrapper.findAll('[data-testid="canvas-technique"] [role="radio"]')
    expect(options.map((o) => o.text())).toEqual([en.form.techniqueLoom, en.form.techniquePeyote, en.form.techniqueBrick, en.form.techniqueRightAngle, en.form.techniqueNetting])
  })

  it('emits the Technique that is chosen', async () => {
    const project = createProject({ technique: 'netting', netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 6, height: 6, unit: 'beads' } })
    const wrapper = mount(CanvasTechniqueRow, { props: { project } })
    await wrapper.get('[data-testid="canvas-technique"] [data-value="loom"]').trigger('click')
    expect(wrapper.emitted('set-technique')).toEqual([['loom']])
  })
})
