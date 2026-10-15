import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, moveToRow, toggleRowDirection, type Project } from '../../domain/project'
import { ru } from '../../i18n/ru'
import { rowProgressOn } from '../../testUtils/rowProgress'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** 10 columns x 20 rows, Row progress on, so Previous/Next both have room to be enabled. */
function makeProject(): Project {
  const project = createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 30, unit: 'mm' },
  })
  return rowProgressOn(project)
}

describe('ProgressBar', () => {
  it('shows the current row and total, 1-based', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b5\D+20\b/)
  })

  it('emits move-row(1) from Next and move-row(-1) from Previous', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-previous"]').trigger('click')

    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('disables Previous at the first row and Next at the last, same as the Toolbox buttons did', () => {
    const project = makeProject()

    const atStart = mount(ProgressBar, { props: { project } })
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').attributes('aria-disabled')).toBe('true')
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').attributes('aria-disabled')).toBeUndefined()

    const atEnd = mount(ProgressBar, { props: { project: moveToRow(project, project.frame!.rows) } })
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').attributes('aria-disabled')).toBeUndefined()
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').attributes('aria-disabled')).toBe('true')
  })

  it('names Row not done and Row done in words (ticket 94); their keys are in the Tooltip, not a title', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })

    const previous = wrapper.find('[data-testid="progress-bar-previous"]')
    const next = wrapper.find('[data-testid="progress-bar-next"]')
    expect(previous.text()).toBe(ru.rowProgress.previousButton)
    expect(previous.attributes('title')).toBeUndefined()
    expect(next.text()).toBe(ru.rowProgress.nextButton)
    expect(next.attributes('title')).toBeUndefined()
  })

  it('fills the track with the finished share of the rows', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 2) } }) // 20 rows

    const track = wrapper.find('[data-testid="progress-bar-track"]')
    expect(track.attributes('aria-valuenow')).toBe('2')
    expect(track.attributes('aria-valuemax')).toBe('20')
    expect(track.find('span').attributes('style')).toContain('width: 10%')
  })

  it('shows a compact "current/total" counter and large text Previous/Next with their hotkeys (tickets 188, 411)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })

    expect(wrapper.find('[data-testid="progress-bar-compact-position"]').text()).toBe('5/20')

    const previous = wrapper.find('[data-testid="progress-bar-previous"]')
    const next = wrapper.find('[data-testid="progress-bar-next"]')
    expect(previous.classes()).toContain('app-button--lg')
    expect(next.classes()).toContain('app-button--lg')
    expect(previous.find('svg').exists()).toBe(true)
    expect(next.find('svg').exists()).toBe(true)
    // No compact, icon-only twin any more.
    expect(wrapper.find('[data-testid="progress-bar-previous-compact"]').exists()).toBe(false)
  })

  it('names the buttons after a column, with their own arrows, once rows run down the columns (ticket 411)', () => {
    const rows = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })
    expect(rows.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.previousButton)
    expect(rows.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.nextButton)
    expect(rows.find('.progress-bar__steps--columns').exists()).toBe(false)

    const columns = mount(ProgressBar, { props: { project: toggleRowDirection(moveToRow(makeProject(), 4)) } })
    expect(columns.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.columnPreviousButton)
    expect(columns.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.columnNextButton)
    expect(columns.find('.progress-bar__steps--columns').exists()).toBe(true)
  })

  it('fills the whole track once every pass is done, and shows the last row as the current one (ticket 411)', () => {
    const project = makeProject()
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(project, project.frame!.rows) } })

    expect(wrapper.find('[data-testid="progress-bar-track"] span').attributes('style')).toContain('width: 100%')
    expect(wrapper.find('[data-testid="progress-bar-compact-position"]').text()).toBe('20/20')
    expect(wrapper.find('[data-testid="progress-bar-next"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-testid="progress-bar-previous"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('puts Turn row direction beside Remove frame, ahead of the do/undo pair (ticket 411)', () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })
    const order = wrapper
      .findAll('[data-testid="progress-bar-remove-frame"], [data-testid="progress-bar-direction"], [data-testid="progress-bar-previous"], [data-testid="progress-bar-next"]')
      .map((element) => element.attributes('data-testid'))
    expect(order).toEqual(['progress-bar-remove-frame', 'progress-bar-direction', 'progress-bar-previous', 'progress-bar-next'])
  })

  it('says which way the rows run after the total', () => {
    const rows = mount(ProgressBar, { props: { project: makeProject() } })
    expect(rows.find('[data-testid="progress-bar-position"]').text()).toContain(ru.rowProgress.topToBottom)

    const columns = mount(ProgressBar, { props: { project: toggleRowDirection(makeProject()) } })
    expect(columns.find('[data-testid="progress-bar-position"]').text()).toContain(ru.rowProgress.leftToRight)
  })

  it('has no Row progress switch, and shows no Fit to drawing while there is a Frame (ticket 426)', () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })

    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-remove-frame"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('gives every control its key in a Tooltip and no native title (ticket 339)', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })
    const text = wrapper.text()
    expect(text).toContain('Enter, Space')
    expect(text).toContain('Shift+Enter, Shift+Space')
    expect(text).toContain('D')
    expect(wrapper.find('[title]').exists()).toBe(false)
  })

  it('turns the row direction from its button and asks to remove the Frame from the first control', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })

    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-remove-frame"]').trigger('click')

    expect(wrapper.emitted('toggle-row-direction')).toHaveLength(1)
    expect(wrapper.emitted('remove-frame')).toHaveLength(1)
  })
})

describe('ProgressBar with no Frame (ticket 233)', () => {
  function unframedProject(): Project {
    const { frame: _frame, ...rest } = makeProject()
    return rest
  }

  it('shows Remove frame disabled with its reason, "Set Frame to start" and a Fit to drawing button, and no row buttons (ticket 426)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: unframedProject() } })

    const remove = wrapper.find('[data-testid="progress-bar-remove-frame"]')
    expect(remove.attributes('aria-disabled')).toBe('true')
    await remove.trigger('click')
    expect(wrapper.emitted('remove-frame')).toBeUndefined()
    expect(wrapper.text()).toContain(ru.tooltips.noFrameToRemove)
    expect(wrapper.find('[data-testid="progress-bar-needs-frame"]').text()).toBe(ru.frame.progressNeedsFrame)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-previous"]').exists()).toBe(false)

    // Fit to drawing needs something drawn; with a bead it asks the app to frame it.
    await wrapper.find('[data-testid="progress-bar-fit-frame"]').trigger('click')
    expect(wrapper.emitted('fit-frame')).toBeUndefined()
    await wrapper.setProps({ project: { ...unframedProject(), beads: { 0: { 0: '#e63746' } } } })
    await wrapper.find('[data-testid="progress-bar-fit-frame"]').trigger('click')
    expect(wrapper.emitted('fit-frame')).toHaveLength(1)
  })
})
