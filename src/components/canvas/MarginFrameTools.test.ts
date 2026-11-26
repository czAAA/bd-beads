import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MarginFrameTools from './MarginFrameTools.vue'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import { frameIdIn } from '../../testUtils/frameId'
import { withLayers } from '../../testUtils/layerFields'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MarginFrameTools', () => {
  it('closes the Frame popover as Reset progress asks, so nothing is over the question (ticket 1247)', async () => {
    const blank = withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: { technique: 'loom', row: 2, column: 3, rows: 6, columns: 5, beads: {} } })
    const project = moveToRow(blank, 1, frameIdIn(blank))
    const wrapper = mount(MarginFrameTools, { props: { project, frame: frameIdIn(project), items: [], deps: {} as never }, attachTo: document.body })
    await wrapper.get('button[data-testid="margin-frame-tools"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="frame-size-locked-reset"]').trigger('click')

    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
    expect(wrapper.find('[data-testid="frame-popover"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
