import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { createProject } from './domain/createProject'
import type { Project } from './domain/project'
import { downloadFile } from './services/fileDownload'
import { loadProjects } from './services/libraryStore'
import { firstProjectAddress, projectAddress, savedProjectsAddress } from './domain/openingAddress'
import { storedHugeProject, storeLibrary } from './testUtils/hugeProject'
import { withLayers } from './testUtils/layerFields'
import { closePanel, openPanel, openSavedProjects } from './testUtils/pill'

// How the editor opens (ticket 0716): safe start, the size gate and its own addresses, wired from storage to screen.
// What each decides is in useSafeStart, useProjectLibrary and useSavedProjectConfirms's tests.

vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn() }))
// Another tab has this one Project open first (ticket 0834); every other Project is this tab's.
const OPEN_ELSEWHERE = 'open-in-another-tab'
vi.mock('./services/projectLocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/projectLocks')>()),
  browserProjectLocks: {
    claim: (id: string, onHeld: (held: boolean) => void) => {
      onHeld(id !== OPEN_ELSEWHERE)
      return () => undefined
    },
  },
}))

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
    await wrapper.get('[data-testid="delete-project-modal"] [data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadProjects().map((each) => each.id)).toEqual([other.id])
    expect(wrapper.find('[data-testid="missed-project"]').exists()).toBe(false)
  })

  it('names the last Project after its delete on the empty Canvas, whose link opens the Projects library (ticket 0840)', async () => {
    storeLibrary([project('Sunflower', 1000)])
    const wrapper = mount(App)
    await flushPromises()

    await openPanel(wrapper, 'strip-project')
    await wrapper.get('[data-testid="project-delete"]').trigger('click')
    await wrapper.get('[data-testid="delete-project-modal"] [data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    await closePanel(wrapper)

    const message = wrapper.get('[data-testid="empty-canvas-message"]')
    expect(message.get('.empty-canvas__title').text()).toBe('“Sunflower” was deleted.')
    await message.get('[data-testid="empty-canvas-library"]').trigger('click')
    expect(wrapper.find('[data-testid="project-list"]').exists()).toBe(true)
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

  it('makes the first Project at once at Make your first Project\'s address, on the Canvas with no panel open (ticket 0866)', async () => {
    storeLibrary([])
    history.replaceState(null, '', firstProjectAddress('/'))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.get('[data-testid="project-surface"]').attributes('aria-label') ?? '').toContain('Project 1')
    expect(wrapper.find('[data-testid="pill-tool-paint"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(loadProjects()).toHaveLength(1)
    expect(location.search).toBe('')
  })

  it('makes no Project at that address once the library has one, and opens as usual', async () => {
    storeLibrary([project('Scarf', 1000)])
    history.replaceState(null, '', firstProjectAddress('/'))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.get('[data-testid="project-surface"]').attributes('aria-label') ?? '').toContain('Scarf')
    expect(loadProjects()).toHaveLength(1)
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

  it('says so in the notice row when the open Project is open in another tab first', async () => {
    storeLibrary([withLayers(project('Shared', 2000), { id: OPEN_ELSEWHERE })])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.get('[data-testid="open-elsewhere-message"]').text()).toBe(
      "This Project is open in another tab. Changes made here aren't saved while it is open there.",
    )
  })
})
