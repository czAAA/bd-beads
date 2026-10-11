import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { seedProject } from './testUtils/seedProject'
import { pressBead } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { downloadFile } from './services/fileDownload'
import { createProject, frameGrid } from './domain/project'
import { parseProjectsFile, projectFileName } from './domain/projectFile'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { refuseStorageWrites, spyOnStorageWrites } from './testUtils/storageWrites'

/** Save hands the browser a file (ticket 119); jsdom can't download one, so the hand-over is observed instead. */
vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn(), sharesFromTap: () => false }))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const PROJECTS_KEY = 'bd-beads:patterns'

/** Tests here dispatch keydowns on window, so every mounted App is torn down to keep one test's listener off the next's events. */
const mounted: ReturnType<typeof mount>[] = []
function mountApp() {
  const wrapper = mount(App)
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.mocked(downloadFile).mockClear()
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Dispatches a cancelable keydown on window and hands the event back, so a test can see whether it was default-prevented. */
async function pressKey(init: KeyboardEventInit): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(event)
  await flushPromises()
  return event
}

/** Starts a paint stroke without releasing it, so the painted cell is on screen but its save is still deferred. */
async function startUnfinishedStroke(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-color-id="red"]').trigger('click')
  await pressBead(wrapper, 0)
}

describe('App Save (ticket 115)', () => {
  it('writes a pending change to the device and shows "Saved"', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await startUnfinishedStroke(wrapper)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find('[data-testid="save-confirmation"]').text()).toBe(en.tools.savedConfirmation)
    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)
  })

  it('also hands over the open Project as a Project file (ticket 119)', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()

    await wrapper.find('[data-testid="save-button"]').trigger('click')

    const saved = loadProjects()[0]!
    expect(downloadFile).toHaveBeenCalledTimes(1)
    const [fileName, contents] = vi.mocked(downloadFile).mock.calls[0]!
    expect(fileName).toBe(projectFileName(saved))
    expect(parseProjectsFile(contents as string)).toEqual({ projects: [saved] })
  })

  it('still hands over the Project file when the device refuses the write, since it is then the only copy', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()

    refuseStorageWrites(PROJECTS_KEY)
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(downloadFile).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('takes the "Saved" confirmation down by itself after a moment', async () => {
    vi.useFakeTimers()
    seedProject(15, 30)
    const wrapper = mountApp()

    await wrapper.find('[data-testid="save-button"]').trigger('click')
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('keeps showing "Saved" for a full period after a second press, rather than being cut short by the first one\'s timer', async () => {
    vi.useFakeTimers()
    seedProject(15, 30)
    const wrapper = mountApp()

    await wrapper.find('[data-testid="save-button"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)

    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)
  })

  it('shows the "couldn\'t save" notice and no "Saved" when the device refuses the write', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await startUnfinishedStroke(wrapper)

    refuseStorageWrites(PROJECTS_KEY)
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(en.storage.saveFailedMessage)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('does not leave a "Saved" showing when a later Save is refused', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)

    refuseStorageWrites(PROJECTS_KEY)
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it.each([{ ctrlKey: true }, { metaKey: true }])('does the same on %s+S, and suppresses the browser\'s save-page dialog', async (modifier) => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await startUnfinishedStroke(wrapper)

    const event = await pressKey({ key: 's', ...modifier })

    expect(event.defaultPrevented).toBe(true)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)
  })

  it('does nothing on Ctrl+S while a modal is open', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    const writes = spyOnStorageWrites(PROJECTS_KEY)

    await pressKey({ key: 's', ctrlKey: true })

    expect(writes.count).toBe(0)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('does nothing on Ctrl+S when no Project is open', async () => {
    saveProjects([createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } })])
    const wrapper = mountApp()
    await wrapper.find('[data-testid="new-project-button"]').trigger('click') // back to no Project open
    const writes = spyOnStorageWrites(PROJECTS_KEY)

    await pressKey({ key: 's', ctrlKey: true })

    expect(writes.count).toBe(0)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('leaves a plain S alone', async () => {
    seedProject(15, 30)
    mountApp()
    const writes = spyOnStorageWrites(PROJECTS_KEY)

    const event = await pressKey({ key: 's' })

    expect(event.defaultPrevented).toBe(false)
    expect(writes.count).toBe(0)
  })
})
