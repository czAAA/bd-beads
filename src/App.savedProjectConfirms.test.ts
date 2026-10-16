import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead } from './testUtils/beads'
import { loadProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { refuseStorageWrites } from './testUtils/storageWrites'
import { openSavedProjects, openSheet, pickColor } from './testUtils/dock'
import { createProjectViaForm } from './testUtils/seedProject'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => vi.restoreAllMocks())

type Wrapper = ReturnType<typeof mount>


/** "Other" saved first, then "Current" open. */
async function twoProjects() {
  const wrapper = mount(App)
  await createProjectViaForm(wrapper, 'Other')
  await createProjectViaForm(wrapper, 'Current')
  const idOf = (name: string) => loadProjects().find((project) => project.name === name)!.id
  return { wrapper, otherId: idOf('Other'), currentId: idOf('Current') }
}

const click = async (wrapper: Wrapper, testId: string) => {
  if (/^(select|remove)-project-/.test(testId)) {
    await openSavedProjects(wrapper)
  }
  await wrapper.find(`[data-testid="${testId}"]`).trigger('click')
}
/** The open Project's summary line, in the Project sheet (PhoneSheets card). */
const openName = async (wrapper: Wrapper) => {
  await openSheet(wrapper, 'strip-project')
  return wrapper.find('[data-testid="phone-project-summary"]').text()
}
const names = () => loadProjects().map((project) => project.name).sort()

describe('Saved Projects confirms remove (ticket 232)', () => {
  it('names the Project in a danger confirmation and deletes only on confirm', async () => {
    const { wrapper, otherId } = await twoProjects()

    await click(wrapper, `remove-project-${otherId}`)

    const modal = wrapper.find('[data-testid="remove-project-modal"]')
    expect(modal.text()).toContain('“Other”')
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').classes().join(' ')).toContain('danger')
    expect(names()).toEqual(['Current', 'Other'])

    await click(wrapper, 'confirm-modal-confirm')
    expect(names()).toEqual(['Current'])
  })
})

describe('Saved Projects confirms switching (ticket 232)', () => {
  it('names both Projects and opens the picked one only on confirm', async () => {
    const { wrapper, otherId } = await twoProjects()

    await click(wrapper, `select-project-${otherId}`)

    const modal = wrapper.find('[data-testid="switch-project-modal"]')
    expect(modal.text()).toContain('“Current”')
    expect(modal.text()).toContain('“Other”')
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.switchProject.confirmButton)
    expect(await openName(wrapper)).toContain('Current')

    await click(wrapper, 'confirm-modal-confirm')
    expect(wrapper.find('[data-testid="switch-project-modal"]').exists()).toBe(false)
    expect(await openName(wrapper)).toContain('Other')
  })

  it('offers Save first and Switch anyway when the current Project is not saved', async () => {
    const { wrapper, otherId } = await twoProjects()
    refuseStorageWrites('openbeads:patterns')
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, { row: 0, column: 0 })
    await wrapper.find('.app-shell').trigger('mouseup')

    await click(wrapper, `select-project-${otherId}`)

    const modal = wrapper.find('[data-testid="switch-project-modal"]')
    expect(modal.text()).toContain('“Current” is not saved')
    expect(wrapper.find('[data-testid="confirm-modal-extra"]').text()).toBe(en.switchProject.saveButton)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.importSwitch.switchAnywayButton)

    await click(wrapper, 'confirm-modal-extra')
    expect(wrapper.find('[data-testid="switch-project-save-failed"]').text()).toBe(en.storage.saveFailedMessage)

    await click(wrapper, 'confirm-modal-confirm')
    expect(await openName(wrapper)).toContain('Other')
  })
})
