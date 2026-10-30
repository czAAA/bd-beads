import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { createProject } from './domain/createProject'
import type { Project } from './domain/project'
import { downloadFile } from './services/fileDownload'
import { loadProjects } from './services/libraryStore'
import { projectAddress, savedProjectsAddress } from './domain/openingAddress'
import { storedHugeProject, storeLibrary } from './testUtils/hugeProject'
import { withLayers } from './testUtils/layerFields'
import { openSavedProjects } from './testUtils/pill'

// How the editor opens (ticket 0716): safe start, the size gate and its own addresses, wired from storage to screen.
// What each decides is in useSafeStart, useProjectLibrary and useSavedProjectConfirms's tests.

vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn() }))

function project(name: string, updatedAt: number): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 4, height: 4, unit: 'beads' } }), { updatedAt, savedAt: updatedAt })
}

beforeEach(() => {
  localStorage.setItem('openbeads:storage-note-seen', 'yes')
  vi.mocked(downloadFile).mockClear()
})

afterEach(() => {
  history.replaceState(null, '', '/')
})

describe('opening the editor (ticket 0716)', () => {
  it('opens no Project after a load that never drew one, says so, and exports and removes it from the notice', async () => {
    const scarf = project('Scarf', 2000)
    const other = project('Other', 1000)
    storeLibrary([scarf, other])
    // As a tab that froze opening it would have left it: set by hand, nothing freezes here.
    localStorage.setItem('openbeads:opening', JSON.stringify({ id: scarf.id, name: 'Scarf' }))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="missed-project-message"]').text()).toBe("“Scarf” didn't open last time.")

    await wrapper.get('[data-testid="missed-project-export"]').trigger('click')
    // What the file holds is useExportFlow's to check; here only that the notice reaches it.
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalled())

    await wrapper.get('[data-testid="missed-project-remove"]').trigger('click')
    await wrapper.get('[data-testid="remove-project-modal"] [data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadProjects().map((each) => each.id)).toEqual([other.id])
    expect(wrapper.find('[data-testid="missed-project"]').exists()).toBe(false)
  })

  it('never opens a Project over the size gate at load, and warns before opening it from Saved Projects', async () => {
    const small = project('Small', 1000)
    storeLibrary([small], [storedHugeProject({ id: 'huge', name: 'Black fill', savedAt: 2000 })])

    const wrapper = mount(App)
    await flushPromises()
    await openSavedProjects(wrapper)

    expect(wrapper.find('[data-testid="project-sealed"]').exists()).toBe(true)
    await wrapper.get('[data-testid="select-project-huge"]').trigger('click')
    expect(wrapper.find('[data-testid="open-large-project-modal"]').exists()).toBe(true)
  })

  it('lands on Saved Projects with no Project open at its own address', async () => {
    storeLibrary([project('Scarf', 1000)])
    history.replaceState(null, '', savedProjectsAddress('/'))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-list"]').exists()).toBe(true)
    expect(location.search).toBe('')
  })

  it('opens the Project its address names rather than the most recently saved', async () => {
    const older = project('Older', 1000)
    storeLibrary([project('Newer', 2000), older])
    history.replaceState(null, '', projectAddress('/', older.id))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('[data-testid="project-surface"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="project-surface"]').attributes('aria-label') ?? '').toContain('Older')
  })
})
