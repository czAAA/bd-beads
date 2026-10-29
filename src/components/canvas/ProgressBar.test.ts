import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { moveToRow, toggleRowDirection } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { changeFrame } from '../../domain/changeFrame'
import { rotateFrame } from '../../domain/rotate'
import { ru } from '../../i18n/ru'
import { frameOf, withFrameSheet } from '../../domain/layerRecord'
import { withFields } from '../../testUtils/flatFields'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

/** 10 columns x 20 rows, Row progress on, so Previous/Next both have room to be enabled. */
function makeProject(): Project {
  const project = createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 30, unit: 'mm' },
  })
  return project
}

describe('ProgressBar', () => {
  it('is shielded from the page panning under a vertical touch drag', () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })

    expect(wrapper.find('[data-testid="progress-bar"]').classes()).toContain('no-page-pan')
  })

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

    const atEnd = mount(ProgressBar, { props: { project: moveToRow(project, frameOf(project)!.rows) } })
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
    expect(rows.find('.row-progress__steps--right').exists()).toBe(false)

    const columns = mount(ProgressBar, { props: { project: toggleRowDirection(moveToRow(makeProject(), 4)) } })
    expect(columns.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.columnPreviousButton)
    expect(columns.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.columnNextButton)
    expect(columns.find('.row-progress__steps--right').exists()).toBe(true)

    const up = toggleRowDirection(toggleRowDirection(moveToRow(makeProject(), 4)))
    expect(mount(ProgressBar, { props: { project: up } }).find('.row-progress__steps--up').exists()).toBe(true)
    const left = mount(ProgressBar, { props: { project: toggleRowDirection(up) } })
    expect(left.find('.row-progress__steps--left').exists()).toBe(true)
    expect(left.text()).toContain(ru.rowProgress.rightToLeft)
  })

  it('shows the rows running as the Frame lies, turned with it, still counting its own rows (ticket 0667)', () => {
    const turned = rotateFrame(moveToRow(makeProject(), 4))!
    const wrapper = mount(ProgressBar, { props: { project: turned } })
    expect(wrapper.find('.row-progress__steps--left').exists()).toBe(true)
    expect(wrapper.text()).toContain(ru.rowProgress.rightToLeft)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.nextButton)
  })

  it('shows the last row as the current one once every pass is done (ticket 411)', () => {
    const project = makeProject()
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(project, frameOf(project)!.rows) } })

    expect(wrapper.find('[data-testid="progress-bar-compact-position"]').text()).toBe('20/20')
  })

  it('puts Turn row direction and Reset progress ahead of the do/undo pair (tickets 411, 455)', () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })
    const order = wrapper
      .findAll('[data-testid="progress-bar-direction"], [data-testid="progress-bar-reset"], [data-testid="progress-bar-previous"], [data-testid="progress-bar-next"]')
      .map((element) => element.attributes('data-testid'))
    expect(order).toEqual(['progress-bar-direction', 'progress-bar-reset', 'progress-bar-previous', 'progress-bar-next'])
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
    expect(wrapper.find('[data-testid="progress-bar-remove-frame"]').exists()).toBe(false)
  })

  it('gives every control its key in a Tooltip and no native title (ticket 339)', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })
    const text = wrapper.text()
    expect(text).toContain('Enter, Space')
    expect(text).toContain('Shift+Enter, Shift+Space')
    expect(text).toContain('D')
    expect(wrapper.find('[title]').exists()).toBe(false)
  })

  it('turns the row direction from its button and asks to reset progress from the next (tickets 411, 455)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4) } })

    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-reset"]').trigger('click')

    expect(wrapper.emitted('toggle-row-direction')).toHaveLength(1)
    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
  })

  it('offers Row highlight between Turn row direction and Reset progress, on unless it is off (ticket 474)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })
    const order = wrapper
      .findAll('[data-testid="progress-bar-direction"], [data-testid="progress-bar-highlight"], [data-testid="progress-bar-reset"]')
      .map((element) => element.attributes('data-testid'))
    expect(order).toEqual(['progress-bar-direction', 'progress-bar-highlight', 'progress-bar-reset'])
    const button = () => wrapper.get('[data-testid="progress-bar-highlight"]')
    expect(button().attributes('aria-checked')).toBe('true')
    expect(button().attributes('aria-label')).toBe(ru.rowProgress.highlightButton)

    await wrapper.setProps({ rowHighlight: false })
    expect(button().attributes('aria-checked')).toBe('false')
    await button().trigger('click')
    expect(wrapper.emitted('toggle-row-highlight')).toHaveLength(1)
  })

  it('has no Row highlight while there is no Frame (ticket 474)', () => {
    const wrapper = mount(ProgressBar, { props: { project: withFields(makeProject(), { frame: undefined }) } })
    expect(wrapper.find('[data-testid="progress-bar-highlight"]').exists()).toBe(false)
  })

  it('disables Reset progress, with its reason, while no row is done (ticket 455)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })

    const reset = wrapper.find('[data-testid="progress-bar-reset"]')
    expect(reset.attributes('aria-disabled')).toBe('true')
    await reset.trigger('click')
    expect(wrapper.emitted('reset-progress')).toBeUndefined()
    expect(wrapper.text()).toContain(ru.tooltips.noProgressToReset)
  })
})

describe('ProgressBar with no Frame (ticket 233)', () => {
  function unframedProject(): Project {
    const rest = withFrameSheet(makeProject(), undefined)
    return rest
  }

  it('shows "Select to set a Frame" and a Fit to drawing button, and no row buttons (ticket 426)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: unframedProject() } })

    expect(wrapper.find('[data-testid="progress-bar-remove-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-reset"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-needs-frame"]').text().replace(/\s+/g, ' ')).toBe(`${ru.frame.progressSelectToSet} ${ru.frame.progressFrameWord}`)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-previous"]').exists()).toBe(false)

    // Fit to drawing needs something drawn; with a bead it asks the app to frame it.
    await wrapper.find('[data-testid="progress-bar-fit-frame"]').trigger('click')
    expect(wrapper.emitted('fit-frame')).toBeUndefined()
    await wrapper.setProps({ project: withFields(unframedProject(), { beads: { 0: { 0: '#e63746' } } }) })
    await wrapper.find('[data-testid="progress-bar-fit-frame"]').trigger('click')
    expect(wrapper.emitted('fit-frame')).toHaveLength(1)
  })
})

describe('ProgressBar keyboard (ticket 563, ADR 0075)', () => {
  it('is one Tab stop, ←/→ stepping along its controls and stopping at the ends', async () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() }, attachTo: document.body })
    const buttons = wrapper.findAll('button')
    expect(buttons.filter((button) => button.attributes('tabindex') === '0')).toHaveLength(1)

    ;(buttons[0]!.element as HTMLElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    wrapper.unmount()
  })
})

describe('ProgressBar on a Custom frame (ticket 0594)', () => {
  /** The bar's position line as it reads, its spans' spacing collapsed. */
  const spoken = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="progress-bar-position"]').text().replace(/\s+/g, ' ')

  it('counts a Triangle\'s rounds, with no Turn row direction', () => {
    const placed = changeFrame(makeProject(), { custom: { shape: 'triangle', size: 4, centre: { row: 10, column: 10 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Triangle')
    const project = moveToRow(placed.project, 2)
    const wrapper = mount(ProgressBar, { props: { project } })

    expect(spoken(wrapper)).toBe('Круг 3 из 4')
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="progress-bar-direction"]').exists()).toBe(false)
  })

  it('names a Star\'s part and its joins', () => {
    const placed = changeFrame(makeProject(), { custom: { shape: 'star', size: 3, centre: { row: 10, column: 10 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Star')
    const inPart = mount(ProgressBar, { props: { project: moveToRow(placed.project, 4) } })
    expect(spoken(inPart)).toBe('Часть 2, круг 2 · 5 из 20')
    const joining = mount(ProgressBar, { props: { project: moveToRow(placed.project, 15) } })
    expect(spoken(joining)).toBe('Сшить 1–2 · 16 из 20')
  })

  it('goes through a Fringe earring\'s top and then its strands, each counted of all its passes (ticket 0597)', () => {
    const settings = { topWidth: 5, topRows: 4, fringeStyle: 'straight', fringeLength: 6 } as const
    const placed = changeFrame(makeProject(), { custom: { shape: 'fringeEarring', settings, centre: { row: 10, column: 10 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Fringe earring')
    expect(spoken(mount(ProgressBar, { props: { project: moveToRow(placed.project, 1) } }))).toBe('Ряд 2 · 2 из 9')
    expect(spoken(mount(ProgressBar, { props: { project: moveToRow(placed.project, 6) } }))).toBe('Нить 3 · 7 из 9')
  })
})
