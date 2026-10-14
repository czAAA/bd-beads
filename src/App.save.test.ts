import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { seedProject } from './testUtils/seedProject'
import { pressBead } from './testUtils/beads'
import { downloadFile } from './services/fileDownload'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { refuseStorageWrites } from './testUtils/storageWrites'
import { openSheet, pickColor } from './testUtils/dock'

/** Save hands the browser a file (ticket 119); jsdom can't download one, so the hand-over is observed instead. */
vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn(), sharesFromTap: () => false }))

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
  await pickColor(wrapper, 'red')
  await pressBead(wrapper, 0)
}

describe('App Save (ticket 115)', () => {
  it('writes a pending change to the device and shows "Saved"', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await startUnfinishedStroke(wrapper)
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()

    await openSheet(wrapper, 'dock-project')

    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find('[data-testid="save-confirmation"]').text()).toBe(en.tools.savedConfirmation)
    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)
  })

  it('shows the "couldn\'t save" notice and no "Saved" when the device refuses the write', async () => {
    seedProject(15, 30)
    const wrapper = mountApp()
    await startUnfinishedStroke(wrapper)

    refuseStorageWrites(PROJECTS_KEY)
    await openSheet(wrapper, 'dock-project')
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(en.storage.saveFailedMessage)
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
})
