import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { downloadFile } from './domain/fileDownload'
import { createPattern } from './domain/pattern'
import { parsePatternsFile, patternFileName } from './domain/patternFile'
import { loadPatterns, savePatterns } from './domain/patternStorage'
import { en } from './i18n/en'
import { denselyColoredGrid } from './testUtils/denselyColoredGrid'
import { refuseStorageWrites, spyOnStorageWrites } from './testUtils/storageWrites'

/** Save hands the browser a file (ticket 119); jsdom can't download one, so the hand-over is observed instead. */
vi.mock('./domain/fileDownload', () => ({ downloadFile: vi.fn() }))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const PATTERNS_KEY = 'bd-beads:patterns'

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

async function createPatternViaForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue('15')
  await wrapper.find('[data-testid="height-input"]').setValue('30')
  await wrapper.find('form').trigger('submit')
}

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
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await startUnfinishedStroke(wrapper)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find('[data-testid="save-confirmation"]').text()).toBe(en.tools.savedConfirmation)
    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)
  })

  it('also hands over the open Pattern as a Pattern file (ticket 119)', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)

    await wrapper.find('[data-testid="save-button"]').trigger('click')

    const saved = loadPatterns()[0]!
    expect(downloadFile).toHaveBeenCalledTimes(1)
    const [fileName, contents] = vi.mocked(downloadFile).mock.calls[0]!
    expect(fileName).toBe(patternFileName(saved))
    expect(parsePatternsFile(contents as string)).toEqual({ patterns: [saved] })
  })

  it('still hands over the Pattern file when the device refuses the write, since it is then the only copy', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)

    refuseStorageWrites(PATTERNS_KEY)
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(downloadFile).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('takes the "Saved" confirmation down by itself after a moment', async () => {
    vi.useFakeTimers()
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)

    await wrapper.find('[data-testid="save-button"]').trigger('click')
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('keeps showing "Saved" for a full period after a second press, rather than being cut short by the first one\'s timer', async () => {
    vi.useFakeTimers()
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)

    await wrapper.find('[data-testid="save-button"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)

    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)
  })

  it('shows the "couldn\'t save" notice and no "Saved" when the device refuses the write', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await startUnfinishedStroke(wrapper)

    refuseStorageWrites(PATTERNS_KEY)
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(en.storage.saveFailedMessage)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('does not leave a "Saved" showing when a later Save is refused', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await wrapper.find('[data-testid="save-button"]').trigger('click')
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)

    refuseStorageWrites(PATTERNS_KEY)
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it.each([{ ctrlKey: true }, { metaKey: true }])('does the same on %s+S, and suppresses the browser\'s save-page dialog', async (modifier) => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await startUnfinishedStroke(wrapper)

    const event = await pressKey({ key: 's', ...modifier })

    expect(event.defaultPrevented).toBe(true)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(true)
  })

  it('does nothing on Ctrl+S while a modal is open', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    const writes = spyOnStorageWrites(PATTERNS_KEY)

    await pressKey({ key: 's', ctrlKey: true })

    expect(writes.count).toBe(0)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('does nothing on Ctrl+S when no Pattern is open', async () => {
    savePatterns([createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } })])
    const wrapper = mountApp()
    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click') // back to no Pattern open
    const writes = spyOnStorageWrites(PATTERNS_KEY)

    await pressKey({ key: 's', ctrlKey: true })

    expect(writes.count).toBe(0)
    expect(wrapper.find('[data-testid="save-confirmation"]').exists()).toBe(false)
  })

  it('leaves a plain S alone', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    const writes = spyOnStorageWrites(PATTERNS_KEY)

    const event = await pressKey({ key: 's' })

    expect(event.defaultPrevented).toBe(false)
    expect(writes.count).toBe(0)
  })
})

/** QR code is an item of the save box's Export menu (ticket 148). */
async function openQrPanel(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
  await wrapper.find('[data-testid="export-qr"]').trigger('click')
}

describe('App QR export (ticket 116)', () => {
  it('opens the QR panel for the open Pattern from the Export menu, and Close hides it', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    expect(wrapper.find('[data-testid="qr-export-panel"]').exists()).toBe(false)

    await openQrPanel(wrapper)

    expect(wrapper.find('[data-testid="qr-export-panel"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="qr-code-module"]').length).toBeGreaterThan(0)

    await wrapper.find('[data-testid="qr-export-close"]').trigger('click')

    expect(wrapper.find('[data-testid="qr-export-panel"]').exists()).toBe(false)
  })

  it('closes the panel on Escape without also backing out of Select', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')
    await openQrPanel(wrapper)

    await pressKey({ key: 'Escape' })

    expect(wrapper.find('[data-testid="qr-export-panel"]').exists()).toBe(false)
    expect(selectedBeadCount(wrapper)).toBe(2) // untouched by that Escape
  })

  it('withholds the editing shortcuts while the panel is open, like any other modal', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)
    await openQrPanel(wrapper)

    await pressKey({ key: 'r' })

    expect(loadPatterns()[0]!.rotation).toBe(0)
  })

  it('turns the menu item off for a Pattern too large for a QR code, with the reason under it', async () => {
    const huge = createPattern({
      name: 'Huge',
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 90, height: 135, unit: 'mm' }, // 60 x 90, ADR 0009's own worst-case size
    })
    savePatterns([{ ...huge, grid: denselyColoredGrid(huge.columns, huge.rows) }])
    const wrapper = mountApp()
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-qr"]').element.disabled).toBe(true)
    expect(wrapper.find('[data-testid="export-qr-reason"]').text()).toBe(en.transfer.qrTooLargeMessage)
  })

  it('is gone from the Export and import box', async () => {
    const wrapper = mountApp()
    await createPatternViaForm(wrapper)

    expect(wrapper.find('[data-testid="pattern-transfer"] [data-testid="export-qr"]').exists()).toBe(false)
  })
})
