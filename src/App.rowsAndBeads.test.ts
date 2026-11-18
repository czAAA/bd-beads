import { beforeEach, describe, expect, it } from 'vitest'
import type { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProjectSurface from './components/canvas/ProjectSurface.vue'
import { pressBead, rowProgressView } from './testUtils/beads'
import { loadProjects } from './services/libraryStore'
import { mountWithProject } from './testUtils/seedProject'
import { deleteAll, pickColor, panelRead } from './testUtils/pill'
import { frameGrid } from './testUtils/frameGrid'
import { ru } from './i18n/ru'
import { defaultColorOf } from './testUtils/defaultColors'

// Each test drives one control to its flow. What the flows decide is in useRowOps and useDeleteAllFlow, the rules in
// domain/project, what the controls show in ProgressBar, BeadQuantities and ConfirmModal (ticket 0603), and Replace
// bead from the Project panel in AppPanels.test (ticket 0618).

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

/** Presses and releases one bead without moving: a click. */
async function click(wrapper: ReturnType<typeof mount>, index: number) {
  await pressBead(wrapper, index)
  await wrapper.find('.app-shell').trigger('mouseup')
}

const loadedProject = () => loadProjects()[0]!

describe('App row progress', () => {
  it('turns the row direction from the Progress bar\'s list, and the canvas overlay follows the steps down the columns (ticket 0973)', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows

    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-direction-right"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(rowProgressView(wrapper)).toMatchObject({ direction: 'columns', finished: 2, current: 2 })
  })

  it('keeps Row highlight in the device, not the Project: read at start, saved when turned, handed to the bar and the canvas (ticket 474)', async () => {
    localStorage.setItem('openbeads:row-highlight', 'off')
    const wrapper = await mountWithProject(15, 30)
    // Show row marks, in Turn row direction's list (ticket 0973).
    await wrapper.get('[data-testid="progress-bar-direction"]').trigger('click')
    const highlight = () => wrapper.get('[data-testid="progress-bar-row-marks"]').attributes('aria-checked')
    const rowMarks = () => wrapper.findComponent(ProjectSurface).props('rowMarks')

    expect(highlight()).toBe('false')
    expect(rowMarks()).toBe(false)

    await wrapper.get('[data-testid="progress-bar-row-marks"]').trigger('click')

    expect(localStorage.getItem('openbeads:row-highlight')).toBe('on')
    expect(highlight()).toBe('true')
    expect(rowMarks()).toBe(true)
    expect(JSON.stringify(loadProjects())).not.toContain('highlight')
  })

  it('hands a press of Row done to the canvas, which Undo stops (ticket 0730)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const rowPress = () => wrapper.findComponent(ProjectSurface).props('rowPress')
    await pickColor(wrapper, defaultColorOf('red').id)
    await click(wrapper, 0)

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    expect(rowPress()).toMatchObject({ done: true, from: 0, to: 1 })

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')
    expect(rowPress()).toBeUndefined()
  })

  it('says each row move aloud through the announcer (ticket 0934)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="announcer"]').text()).toBe('Ряд 2 из 20')
  })
})

describe('App rows marked done', () => {
  it('says why a press on a row marked done draws nothing (ticket 0848)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, defaultColorOf('red').id)
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await click(wrapper, 0)
    expect(wrapper.get('[data-testid="marked-done"]').text()).toContain(ru.rowProgress.markedDoneToast)
  })
})

describe('App delete all', () => {
  it('asks first: Cancel keeps the beads, Delete all empties every cell', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, defaultColorOf('red').id)
    await click(wrapper, 0)

    await deleteAll(wrapper)
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe(defaultColorOf('red').hex)

    await deleteAll(wrapper)
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(frameGrid(loadedProject()).flat().every((cell) => cell.color === null)).toBe(true)
  })
})

describe('App bead quantities', () => {
  it('counts the painted beads of each color in the Frame panel', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, defaultColorOf('red').id)
    // Each press is released: the counts wait for a stroke to end (ticket 0680).
    await click(wrapper, 0)
    await click(wrapper, 1)
    await pickColor(wrapper, defaultColorOf('blue').id)
    await click(wrapper, 2)

    expect((await panelRead(wrapper, `quantity-count-${defaultColorOf('red').id}`, 'strip-frame')).text).toBe('2')
    expect((await panelRead(wrapper, `quantity-count-${defaultColorOf('blue').id}`, 'strip-frame')).text).toBe('1')
  })
})
