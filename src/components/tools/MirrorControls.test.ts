import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MirrorControls from './MirrorControls.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { turnedClockwise } from '../../testUtils/rotated'
import { createProject, type Project } from '../../domain/project'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(rotated = false): Project {
  const project = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
  return rotated ? turnedClockwise(project) : project
}

function mountControls(project: Project, mirrorAxisCounts = { columns: 2, rows: 1 }) {
  return mount(MirrorControls, {
    props: { project, mirrorAxisCounts, mirrorCopyMode: false },
  })
}

describe('MirrorControls (pulled out of Toolbox.vue for ticket 79\'s Mirror ToolSheet)', () => {
  it('drives left-right/top-bottom from columns/rows, swapped once the Project is rotated', () => {
    const unrotated = mountControls(makeProject(false))
    expect(unrotated.get('[data-testid="mirror-left-right-value"]').text()).toContain('2')
    expect(unrotated.get('[data-testid="mirror-top-bottom-value"]').text()).toContain('1')

    const rotated = mountControls(makeProject(true))
    expect(rotated.get('[data-testid="mirror-left-right-value"]').text()).toContain('1')
    expect(rotated.get('[data-testid="mirror-top-bottom-value"]').text()).toContain('2')
  })

  it('emits the grid-space axis a counter button was pressed for, not the screen one', async () => {
    const rotated = mountControls(makeProject(true))
    await rotated.get('[data-testid="mirror-left-right-increase"]').trigger('click')
    // Left-right is the rows axis once rotated (the view-only turn swaps width and height).
    expect(rotated.emitted('set-mirror-axis-count')![0]).toEqual(['rows', 2])
  })

  it('toggles copy mode and fires Mirror current for each direction, with its hover preview', async () => {
    const wrapper = mountControls(makeProject())

    await wrapper.get('[data-testid="mirror-copy-mode"]').trigger('click')
    expect(wrapper.emitted('toggle-mirror-copy-mode')).toHaveLength(1)

    await wrapper.get('[data-testid="mirror-current-horizontal"]').trigger('mouseenter')
    expect(wrapper.emitted('mirror-current-hover')![0]).toEqual(['horizontal'])
    await wrapper.get('[data-testid="mirror-current-horizontal"]').trigger('click')
    expect(wrapper.emitted('mirror-current')![0]).toEqual(['horizontal'])
    await wrapper.get('[data-testid="mirror-current-vertical"]').trigger('click')
    expect(wrapper.emitted('mirror-current')![1]).toEqual(['vertical'])
  })
})
