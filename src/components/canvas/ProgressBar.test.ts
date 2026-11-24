import { frameIdIn } from '../../testUtils/frameId'
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
import { frameOf } from '../../domain/layerRecord'
import { withFrameSheet } from '../../domain/frameSheet'
import { withLayers } from '../../testUtils/layerFields'
import { turnedClockwise } from '../../testUtils/rotated'

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
  it('is an empty bar with no Project and nothing in its slot (ticket 0748)', () => {
    const wrapper = mount(ProgressBar)

    expect(wrapper.find('[data-testid="progress-bar"]').element.children).toHaveLength(0)
  })

  it('is shielded from the page panning under a vertical touch drag', () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })

    expect(wrapper.find('[data-testid="progress-bar"]').classes()).toContain('no-page-pan')
  })

  it('shows the current row and total, 1-based', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b5\D+20\b/)
  })

  it('emits move-row(1) from Next and move-row(-1) from Previous', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-previous"]').trigger('click')

    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('disables Previous at the first row and Next at the last, same as the Toolbox buttons did', () => {
    const project = makeProject()

    const atStart = mount(ProgressBar, { props: { project } })
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').attributes('aria-disabled')).toBe('true')
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').attributes('aria-disabled')).toBeUndefined()

    const atEnd = mount(ProgressBar, { props: { project: moveToRow(project, frameOf(project)!.rows, frameIdIn(project)) } })
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').attributes('aria-disabled')).toBeUndefined()
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').attributes('aria-disabled')).toBe('true')
  })

  it('names Row not done and Row done in words (ticket 94); their keys are in the Tooltip, not a title', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })

    const previous = wrapper.find('[data-testid="progress-bar-previous"]')
    const next = wrapper.find('[data-testid="progress-bar-next"]')
    expect(previous.text()).toBe(ru.rowProgress.previousButton)
    expect(previous.attributes('title')).toBeUndefined()
    expect(next.text()).toBe(ru.rowProgress.nextButton)
    expect(next.attributes('title')).toBeUndefined()
  })

  it('fills the track with the finished share of the rows', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 2, frameIdIn(makeProject())) } }) // 20 rows

    const track = wrapper.find('[data-testid="progress-bar-track"]')
    expect(track.attributes('aria-valuenow')).toBe('2')
    expect(track.attributes('aria-valuemax')).toBe('20')
    // Grown by transform (ticket 0730): the fill is the track's width, moved left by the share still to weave.
    expect(track.find('.progress-track__fill').attributes('style')).toContain('translateX(-90%)')
    // A row at a time, so the fill keeps its ease; only a bar following a scroll drops it (ticket 0786).
    expect(track.classes()).not.toContain('progress-track--following')
  })

  it('names the counter\'s step, with a short "current/total" for a narrow bar, and Back a row / Row done as the bar of steps\' quiet 32px pair (tickets 188, 411, 0788, 0972)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })

    const counter = wrapper.get('[data-testid="progress-bar-compact-position"]')
    expect(counter.get('.row-progress__count-step').text()).toBe('Ряд 5 из 20')
    expect(counter.get('.row-progress__count-short').text()).toBe('5/20')

    const previous = wrapper.find('[data-testid="progress-bar-previous"]')
    const next = wrapper.find('[data-testid="progress-bar-next"]')
    expect(previous.classes()).toEqual(expect.arrayContaining(['app-button--text', 'app-button--sm']))
    expect(next.classes()).toEqual(expect.arrayContaining(['app-button--primary', 'app-button--sm']))
    expect(previous.find('svg').exists()).toBe(true)
    expect(next.find('svg').exists()).toBe(true)
    // No compact, icon-only twin any more.
    expect(wrapper.find('[data-testid="progress-bar-previous-compact"]').exists()).toBe(false)
  })

  it('names the buttons after a column, with their own arrows, once rows run down the columns (ticket 411)', () => {
    const rows = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })
    expect(rows.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.previousButton)
    expect(rows.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.nextButton)
    expect(rows.find('.row-progress__steps--right').exists()).toBe(false)

    const columns = mount(ProgressBar, { props: { project: toggleRowDirection(moveToRow(makeProject(), 4, frameIdIn(makeProject())), frameIdIn(moveToRow(makeProject(), 4, frameIdIn(makeProject())))) } })
    expect(columns.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.columnPreviousButton)
    expect(columns.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.columnNextButton)
    expect(columns.find('.row-progress__steps--right').exists()).toBe(true)

    const up = toggleRowDirection(toggleRowDirection(moveToRow(makeProject(), 4, frameIdIn(makeProject())), frameIdIn(moveToRow(makeProject(), 4, frameIdIn(makeProject())))), frameIdIn(toggleRowDirection(moveToRow(makeProject(), 4, frameIdIn(makeProject())), frameIdIn(moveToRow(makeProject(), 4, frameIdIn(makeProject()))))))
    expect(mount(ProgressBar, { props: { project: up } }).find('.row-progress__steps--up').exists()).toBe(true)
    const left = mount(ProgressBar, { props: { project: toggleRowDirection(up, frameIdIn(up)) } })
    expect(left.find('.row-progress__steps--left').exists()).toBe(true)
    expect(left.text()).toContain(ru.rowProgress.rightToLeft)
  })

  it('shows the rows running as the Frame lies, turned with it once a pass is done, named as seen (tickets 0667, 1183)', () => {
    const turned = rotateFrame(moveToRow(makeProject(), 4, frameIdIn(makeProject())), undefined, frameIdIn(moveToRow(makeProject(), 4, frameIdIn(makeProject()))))!
    const wrapper = mount(ProgressBar, { props: { project: turned } })
    expect(wrapper.find('.row-progress__steps--left').exists()).toBe(true)
    expect(wrapper.text()).toContain(ru.rowProgress.rightToLeft)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.columnNextButton)
  })

  it('shows the rows running as seen on a turned Canvas, the Frame upright or turned on it (ticket 1101)', async () => {
    const canvasTurned = turnedClockwise(moveToRow(makeProject(), 4, frameIdIn(makeProject())))
    const wrapper = mount(ProgressBar, { props: { project: canvasTurned } })
    expect(wrapper.find('.row-progress__steps--left').exists()).toBe(true)
    expect(wrapper.text()).toContain(ru.rowProgress.rightToLeft)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.columnNextButton)

    // Rotate Frame with no pass done kept top to bottom as seen (ticket 1183); the Canvas's turn still carries it.
    const both = mount(ProgressBar, { props: { project: turnedClockwise(rotateFrame(makeProject(), undefined, frameIdIn(makeProject()))!) } })
    expect(both.find('.row-progress__steps--left').exists()).toBe(true)
    await both.get('[data-testid="progress-bar-direction"]').trigger('click')
    expect(both.get('[data-testid="progress-bar-direction-left"]').attributes('aria-checked')).toBe('true')
  })

  it('shows the last row as the current one on it, and Pattern done with a check once every pass is done (tickets 411, 0849)', () => {
    const project = makeProject()
    const last = mount(ProgressBar, { props: { project: moveToRow(project, frameOf(project)!.rows - 1, frameIdIn(project)) } })
    expect(last.find('[data-testid="progress-bar-compact-position"] .row-progress__count-short').text()).toBe('20/20')

    const done = mount(ProgressBar, { props: { project: moveToRow(project, frameOf(project)!.rows, frameIdIn(project)) } })
    const counter = done.get('[data-testid="progress-bar-compact-position"]')
    expect(counter.text()).toBe(ru.rowProgress.patternDone)
    expect(counter.find('svg').exists()).toBe(true)
    // Its Tooltip and the greyed Row done's say why (F-04-09).
    expect(done.text()).toContain(ru.rowProgress.everyRowDone)
    expect(done.get('[data-testid="progress-bar-next"]').attributes('aria-disabled')).toBe('true')
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

    const columns = mount(ProgressBar, { props: { project: toggleRowDirection(makeProject(), frameIdIn(makeProject())) } })
    expect(columns.find('[data-testid="progress-bar-position"]').text()).toContain(ru.rowProgress.leftToRight)
  })

  it('has no Row progress switch, and no way to a Frame while there is one (tickets 426, 0847)', () => {
    const wrapper = mount(ProgressBar, { props: { project: makeProject() } })

    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-remove-frame"]').exists()).toBe(false)
  })

  it('gives every control its key in a Tooltip and no native title (ticket 339)', () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })
    const text = wrapper.text()
    const keys = wrapper.findAll('.app-tooltip__key').map((chip) => chip.text())
    // Row done is Enter alone and Row not done Shift+Enter: Space only pans (ticket 0835).
    expect(keys).toContain('Enter')
    expect(keys).toContain('Shift+Enter')
    expect(keys.some((key) => key.includes('Space'))).toBe(false)
    expect(text).toContain('D')
    expect(wrapper.find('[title]').exists()).toBe(false)
  })

  it('asks to reset progress from its button (ticket 455)', async () => {
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) } })

    await wrapper.find('[data-testid="progress-bar-reset"]').trigger('click')

    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
  })

  describe('Turn row direction’s list (ticket 0973, UX-060)', () => {
    const list = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="progress-bar-direction-list"]')
    const ways = (wrapper: ReturnType<typeof mount>) => list(wrapper).findAll('[role="radio"]')

    it('opens on the first press with the four ways in words, the current one checked, and turns nothing', async () => {
      const wrapper = mount(ProgressBar, { props: { project: moveToRow(makeProject(), 4, frameIdIn(makeProject())) }, attachTo: document.body })
      const button = wrapper.get('[data-testid="progress-bar-direction"]')
      expect(button.attributes('aria-haspopup')).toBe('dialog')
      expect(list(wrapper).exists()).toBe(false)

      await button.trigger('click')

      expect(button.attributes('aria-expanded')).toBe('true')
      expect(ways(wrapper).map((way) => way.text())).toEqual([ru.rowProgress.topToBottom, ru.rowProgress.leftToRight, ru.rowProgress.bottomToTop, ru.rowProgress.rightToLeft])
      expect(ways(wrapper).map((way) => way.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])
      expect(document.activeElement).toBe(ways(wrapper)[0]!.element)
      expect(wrapper.emitted('set-row-direction')).toBeUndefined()
      wrapper.unmount()
    })

    it('turns the rows the way chosen and closes; the way they run already, or Escape, turns nothing', async () => {
      const wrapper = mount(ProgressBar, { props: { project: makeProject() }, attachTo: document.body })
      const button = wrapper.get('[data-testid="progress-bar-direction"]')

      await button.trigger('click')
      await wrapper.get('[data-testid="progress-bar-direction-up"]').trigger('click')
      expect(wrapper.emitted('set-row-direction')).toEqual([['up']])
      expect(list(wrapper).exists()).toBe(false)

      await button.trigger('click')
      await wrapper.get('[data-testid="progress-bar-direction-down"]').trigger('click')
      expect(wrapper.emitted('set-row-direction')).toHaveLength(1)

      await button.trigger('click')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(list(wrapper).exists()).toBe(false)
      expect(wrapper.emitted('set-row-direction')).toHaveLength(1)
      wrapper.unmount()
    })

    it('checks the way the rows run as the Frame lies', async () => {
      const wrapper = mount(ProgressBar, { props: { project: toggleRowDirection(makeProject(), frameIdIn(makeProject())) }, attachTo: document.body })
      await wrapper.get('[data-testid="progress-bar-direction"]').trigger('click')
      expect(ways(wrapper).map((way) => way.attributes('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
      wrapper.unmount()
    })

    it('holds Row highlight as the Switch Show row marks, named beside it, so the bar has none of its own', async () => {
      const wrapper = mount(ProgressBar, { props: { project: makeProject() }, attachTo: document.body })
      expect(wrapper.find('[data-testid="progress-bar-highlight"]').exists()).toBe(false)

      await wrapper.get('[data-testid="progress-bar-direction"]').trigger('click')
      const marks = () => wrapper.get('[data-testid="progress-bar-row-marks"]')
      expect(marks().attributes('role')).toBe('switch')
      expect(marks().attributes('aria-checked')).toBe('true')
      expect(marks().attributes('aria-label')).toBe(ru.rowProgress.showRowMarks)
      expect(list(wrapper).text()).toContain(ru.rowProgress.showRowMarks)

      await wrapper.setProps({ rowHighlight: false })
      expect(marks().attributes('aria-checked')).toBe('false')
      await marks().trigger('click')
      expect(wrapper.emitted('toggle-row-highlight')).toHaveLength(1)
      // The list stays open, so the beader sees the marks come back.
      expect(list(wrapper).exists()).toBe(true)
      wrapper.unmount()
    })
  })

  it('has no Row highlight while there is no Frame (ticket 474)', () => {
    const wrapper = mount(ProgressBar, { props: { project: withLayers(makeProject(), { frame: undefined }) } })
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
  it('shows no row buttons and no no-Frame line: the canvas footer is not drawn without a Frame', () => {
    const wrapper = mount(ProgressBar, { props: { project: withFrameSheet(makeProject(), undefined, { frame: frameIdIn(makeProject()) }) } })

    expect(wrapper.find('[data-testid="progress-bar-remove-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-needs-frame"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(false)
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
    const placed = changeFrame(makeProject(), { custom: { shape: 'triangle', size: 4, centre: { row: 10, column: 10 } } }, frameIdIn(makeProject()))
    if (placed.kind !== 'changed') throw new Error('expected a Triangle')
    const project = moveToRow(placed.project, 2, frameIdIn(placed.project))
    const wrapper = mount(ProgressBar, { props: { project } })

    expect(spoken(wrapper)).toBe('Круг 3 из 4')
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="progress-bar-direction"]').exists()).toBe(false)
    // With no list to hold it, Row highlight keeps its Switch in the bar (ticket 0973).
    expect(wrapper.find('[data-testid="progress-bar-highlight"]').exists()).toBe(true)
  })

  it('names a Star\'s part and its joins', () => {
    const placed = changeFrame(makeProject(), { custom: { shape: 'star', size: 3, centre: { row: 10, column: 10 } } }, frameIdIn(makeProject()))
    if (placed.kind !== 'changed') throw new Error('expected a Star')
    const inPart = mount(ProgressBar, { props: { project: moveToRow(placed.project, 4, frameIdIn(placed.project)) } })
    expect(spoken(inPart)).toBe('Часть 2, круг 2 · 5 из 20')
    const joining = mount(ProgressBar, { props: { project: moveToRow(placed.project, 15, frameIdIn(placed.project)) } })
    expect(spoken(joining)).toBe('Сшить 1–2 · 16 из 20')
  })

  it('goes through a Fringe earring\'s top and then its strands, each counted of all its passes (ticket 0597)', () => {
    const settings = { topWidth: 5, topRows: 4, fringeStyle: 'straight', fringeLength: 6 } as const
    const placed = changeFrame(makeProject(), { custom: { shape: 'fringeEarring', settings, centre: { row: 10, column: 10 } } }, frameIdIn(makeProject()))
    if (placed.kind !== 'changed') throw new Error('expected a Fringe earring')
    expect(spoken(mount(ProgressBar, { props: { project: moveToRow(placed.project, 1, frameIdIn(placed.project)) } }))).toBe('Ряд 2 · 2 из 9')
    expect(spoken(mount(ProgressBar, { props: { project: moveToRow(placed.project, 6, frameIdIn(placed.project)) } }))).toBe('Нить 3 · 7 из 9')
  })

})

describe('ProgressBar counter (ticket 0849)', () => {
  it('names the pass and adds the rulers\' row on peyote (F-04-03, ticket 0972)', () => {
    const peyote = createProject({ technique: 'peyote', beadId: cubeBead.id, size: { width: 6, height: 14, unit: 'beads' } })
    const wrapper = mount(ProgressBar, { props: { project: moveToRow(peyote, 2, frameIdIn(peyote)) } })

    const counter = wrapper.get('[data-testid="progress-bar-compact-position"]')
    expect(counter.get('.row-progress__count-step').text()).toBe('Проход 3 из 27')
    // The rulers' number of the pass's line: the 2nd from the left, as a new peyote Project's lines run left to right
    // on its turned Canvas, so they are columns as seen (ticket 1183).
    expect(counter.get('.row-progress__line').text()).toBe('· столбец 2')
  })

  it('names the track after a column while rows run down the columns (F-04-05)', () => {
    const wrapper = mount(ProgressBar, { props: { project: toggleRowDirection(makeProject(), frameIdIn(makeProject())) } })
    expect(wrapper.get('[data-testid="progress-bar-track"]').attributes('aria-label')).toBe(ru.rowProgress.columnFinishedLabel)
  })
})
