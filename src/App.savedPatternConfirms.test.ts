import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead } from './testUtils/beads'
import { loadPatterns } from './services/libraryStore'
import { en } from './i18n/en'
import { refuseStorageWrites } from './testUtils/storageWrites'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => vi.restoreAllMocks())

type Wrapper = ReturnType<typeof mount>

async function createOpen(wrapper: Wrapper, name: string) {
  await wrapper.find('[data-testid="name-input"]').setValue(name)
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find('[data-testid="width-input"]').setValue('4')
  await wrapper.find('[data-testid="height-input"]').setValue('4')
  await wrapper.find('form').trigger('submit')
}

/** "Other" saved first, then "Current" open. */
async function twoPatterns() {
  const wrapper = mount(App)
  await createOpen(wrapper, 'Other')
  await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
  await createOpen(wrapper, 'Current')
  const idOf = (name: string) => loadPatterns().find((pattern) => pattern.name === name)!.id
  return { wrapper, otherId: idOf('Other'), currentId: idOf('Current') }
}

const click = (wrapper: Wrapper, testId: string) => wrapper.find(`[data-testid="${testId}"]`).trigger('click')
const openName = (wrapper: Wrapper) => wrapper.find('[data-testid="current-pattern-summary"]').text()
const names = () => loadPatterns().map((pattern) => pattern.name).sort()

describe('Saved Patterns confirms remove (ticket 232)', () => {
  it('names the Pattern in a danger confirmation and deletes only on confirm', async () => {
    const { wrapper, otherId } = await twoPatterns()

    await click(wrapper, `remove-pattern-${otherId}`)

    const modal = wrapper.find('[data-testid="remove-pattern-modal"]')
    expect(modal.text()).toContain('“Other”')
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').classes().join(' ')).toContain('danger')
    expect(names()).toEqual(['Current', 'Other'])

    await click(wrapper, 'confirm-modal-confirm')
    expect(names()).toEqual(['Current'])
  })

  it('Cancel leaves the library and the open Pattern alone', async () => {
    const { wrapper, otherId } = await twoPatterns()
    await click(wrapper, `remove-pattern-${otherId}`)
    await click(wrapper, 'confirm-modal-cancel')

    expect(wrapper.find('[data-testid="remove-pattern-modal"]').exists()).toBe(false)
    expect(names()).toEqual(['Current', 'Other'])
    expect(openName(wrapper)).toContain('Current')
  })
})

describe('Saved Patterns confirms switching (ticket 232)', () => {
  it('names both Patterns and opens the picked one only on confirm', async () => {
    const { wrapper, otherId } = await twoPatterns()

    await click(wrapper, `select-pattern-${otherId}`)

    const modal = wrapper.find('[data-testid="switch-pattern-modal"]')
    expect(modal.text()).toContain('“Current”')
    expect(modal.text()).toContain('“Other”')
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.switchPattern.confirmButton)
    expect(openName(wrapper)).toContain('Current')

    await click(wrapper, 'confirm-modal-confirm')
    expect(wrapper.find('[data-testid="switch-pattern-modal"]').exists()).toBe(false)
    expect(openName(wrapper)).toContain('Other')
  })

  it('Cancel keeps the current Pattern open', async () => {
    const { wrapper, otherId } = await twoPatterns()
    await click(wrapper, `select-pattern-${otherId}`)
    await click(wrapper, 'confirm-modal-cancel')

    expect(wrapper.find('[data-testid="switch-pattern-modal"]').exists()).toBe(false)
    expect(openName(wrapper)).toContain('Current')
  })

  it('does nothing when the picked Pattern is already open', async () => {
    const { wrapper, currentId } = await twoPatterns()
    await click(wrapper, `select-pattern-${currentId}`)

    expect(wrapper.find('[data-testid="switch-pattern-modal"]').exists()).toBe(false)
  })

  it('offers Save first and Switch anyway when the current Pattern is not saved', async () => {
    const { wrapper, otherId } = await twoPatterns()
    refuseStorageWrites('bd-beads:patterns')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')

    await click(wrapper, `select-pattern-${otherId}`)

    const modal = wrapper.find('[data-testid="switch-pattern-modal"]')
    expect(modal.text()).toContain('“Current” is not saved')
    expect(wrapper.find('[data-testid="confirm-modal-extra"]').text()).toBe(en.switchPattern.saveButton)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.importSwitch.switchAnywayButton)

    await click(wrapper, 'confirm-modal-extra')
    expect(wrapper.find('[data-testid="switch-pattern-save-failed"]').text()).toBe(en.storage.saveFailedMessage)

    await click(wrapper, 'confirm-modal-confirm')
    expect(openName(wrapper)).toContain('Other')
  })
})
