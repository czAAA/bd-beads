import { frameIdIn } from '../../testUtils/frameId'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RowProgressControls from './RowProgressControls.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { moveToRow, toggleRowDirection } from '../../domain/rowProgress'
import { changeFrame } from '../../domain/changeFrame'
import { rotateFrame } from '../../domain/rotate'
import { frameOf } from '../../domain/layerRecord'
import { ru } from '../../i18n/ru'
import { turnedClockwise } from '../../testUtils/rotated'
import type { Project } from '../../domain/project'
import type { RowPress } from '../../composables/project/useRowOps'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

/** 10 columns x 20 rows, Row progress on, so Back a row and Row done both have room to be enabled. */
function makeProject(): Project {
  return createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
}

/** The strip of the Project's one Frame, as the margin sheet mounts it. */
function strip(project: Project, props: Record<string, unknown> = {}) {
  return mount(RowProgressControls, { props: { project, frame: frameIdIn(project), testid: 'margin-progress', ...props }, attachTo: document.body })
}
const at = (project: Project, row: number) => moveToRow(project, row, frameIdIn(project))
const id = (name: string) => `[data-testid="margin-progress-${name}"]`

/** What the strip shows, by its test ids and dividers. */
function shown(project: Project, drop: 0 | 1 | 2 | 3 | 4 = 0): string[] {
  const wrapper = strip(project, { drop })
  const parts = wrapper.findAll(':scope > *').map((part) =>
    part.classes('row-progress__divider') ? '|' : (part.attributes('data-testid') ?? part.find('[data-testid]').attributes('data-testid'))!.replace('margin-progress-', ''),
  )
  wrapper.unmount()
  return parts
}

describe('Row progress strip as it runs out of room (MarginSheet card, 1221 option 4B)', () => {
  it('gives up its track first and the two icons last, never Back a row or Row done', () => {
    const icons = ['strip-reset', 'strip-marks']
    expect(shown(makeProject())).toEqual(['settings', 'previous', 'compact-position', 'track', ...icons, 'next'])
    expect(shown(makeProject(), 1)).toEqual(['settings', 'previous', 'compact-position', ...icons, 'next'])
    expect(shown(makeProject(), 3)).toEqual(['settings', 'previous', 'compact-position', ...icons, 'next'])
    expect(shown(makeProject(), 4)).toEqual(['settings', 'previous', 'compact-position', 'next'])
  })

  it('shows Back a row as its arrow alone at the last drop', () => {
    const wide = strip(makeProject())
    expect(wide.get(id('previous')).text()).toBe(ru.rowProgress.previousButton)
    const narrow = strip(makeProject(), { drop: 2 })
    expect(narrow.get(id('previous')).text()).toBe('')
    expect(narrow.get(id('previous')).attributes('aria-label')).toBe(ru.rowProgress.previousButton)
  })

  it('shows Row done as its arrow alone at the very last drop, keeping its name', () => {
    const wrapper = strip(makeProject(), { drop: 3 })
    expect(wrapper.get(id('next')).attributes('aria-label')).toBe(ru.rowProgress.nextButton)
  })

  it('shortens the counter to current/total first', () => {
    const wrapper = strip(at(makeProject(), 4), { shortCount: true })
    expect(wrapper.find('.row-progress--short').exists()).toBe(true)
    expect(wrapper.get('.row-progress__count-short').text()).toBe('5/20')
  })
})

describe('Row progress strip', () => {
  it('emits move-row(1) from Row done and move-row(-1) from Back a row', async () => {
    const wrapper = strip(at(makeProject(), 4))

    await wrapper.get(id('next')).trigger('click')
    await wrapper.get(id('previous')).trigger('click')

    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('disables Back a row at the first row and Row done at the last', () => {
    const project = makeProject()
    const atStart = strip(project)
    expect(atStart.get(id('previous')).attributes('aria-disabled')).toBe('true')
    expect(atStart.get(id('next')).attributes('aria-disabled')).toBeUndefined()

    const atEnd = strip(at(project, frameOf(project)!.rows))
    expect(atEnd.get(id('previous')).attributes('aria-disabled')).toBeUndefined()
    expect(atEnd.get(id('next')).attributes('aria-disabled')).toBe('true')
  })

  it('names Row done as the one filled button and Back a row as a quiet one, each with an arrow (tickets 411, 0788)', () => {
    const wrapper = strip(at(makeProject(), 4))
    expect(wrapper.get(id('previous')).classes()).toEqual(expect.arrayContaining(['app-button--text', 'app-button--sm']))
    expect(wrapper.get(id('next')).classes()).toEqual(expect.arrayContaining(['app-button--primary', 'app-button--sm']))
    expect(wrapper.get(id('previous')).text()).toBe(ru.rowProgress.previousButton)
    expect(wrapper.get(id('next')).text()).toBe(ru.rowProgress.nextButton)
    expect(wrapper.get(id('previous')).find('svg').exists()).toBe(true)
    expect(wrapper.get(id('next')).find('svg').exists()).toBe(true)
    expect(wrapper.get(id('next')).attributes('title')).toBeUndefined()
  })

  it('fills the track with the finished share of the rows, grown by transform (ticket 0730)', () => {
    const track = strip(at(makeProject(), 2)).get(id('track'))
    expect(track.attributes('aria-valuenow')).toBe('2')
    expect(track.attributes('aria-valuemax')).toBe('20')
    expect(track.find('.progress-track__fill').attributes('style')).toContain('translateX(-90%)')
    expect(track.classes()).not.toContain('progress-track--following')
  })

  it('names the counter\'s step, with a short current/total beside it (tickets 188, 0972)', () => {
    const counter = strip(at(makeProject(), 4)).get(id('compact-position'))
    expect(counter.get('.row-progress__count-step').text()).toBe('Ряд 5 из 20')
    expect(counter.get('.row-progress__count-short').text()).toBe('5/20')
  })

  it('names the buttons after a column, with their own arrows, once rows run down the columns (ticket 411)', () => {
    const rows = strip(at(makeProject(), 4))
    expect(rows.get(id('previous')).text()).toBe(ru.rowProgress.previousButton)
    expect(rows.find('.row-progress__arrow--right').exists()).toBe(false)

    const columns = at(toggleRowDirection(makeProject(), frameIdIn(makeProject())), 4)
    const wrapper = strip(columns)
    expect(wrapper.get(id('previous')).text()).toBe(ru.rowProgress.columnPreviousButton)
    expect(wrapper.get(id('next')).text()).toBe(ru.rowProgress.columnNextButton)
    expect(wrapper.find('.row-progress__arrow--right').exists()).toBe(true)

    const up = toggleRowDirection(columns, frameIdIn(columns))
    expect(strip(toggleRowDirection(up, frameIdIn(up))).find('.row-progress__arrow--left').exists()).toBe(true)
  })

  it('shows the rows running as the Frame lies, turned with it once a pass is done, named as seen (tickets 0667, 1183)', () => {
    const turned = rotateFrame(at(makeProject(), 4), undefined, frameIdIn(makeProject()))!
    const wrapper = strip(turned)
    expect(wrapper.find('.row-progress__arrow--left').exists()).toBe(true)
    expect(wrapper.get(id('next')).text()).toBe(ru.rowProgress.columnNextButton)
  })

  it('shows the rows running as seen on a turned Canvas, the Frame upright or turned on it (ticket 1101)', async () => {
    const wrapper = strip(turnedClockwise(at(makeProject(), 4)))
    expect(wrapper.find('.row-progress__arrow--left').exists()).toBe(true)
    expect(wrapper.get(id('next')).text()).toBe(ru.rowProgress.columnNextButton)

    await wrapper.get(id('settings')).trigger('click')
    expect(wrapper.get(id('direction-left')).attributes('aria-checked')).toBe('true')
    wrapper.unmount()
  })

  it('shows the last row as the current one on it, and Pattern done with a check once every pass is done (tickets 411, 0849)', () => {
    const project = makeProject()
    expect(strip(at(project, frameOf(project)!.rows - 1)).get(`${id('compact-position')} .row-progress__count-short`).text()).toBe('20/20')

    const done = strip(at(project, frameOf(project)!.rows))
    const counter = done.get(id('compact-position'))
    expect(counter.text()).toBe(ru.rowProgress.patternDone)
    expect(counter.find('svg').exists()).toBe(true)
    expect(done.text()).toContain(ru.rowProgress.everyRowDone)
    expect(done.get(id('next')).attributes('aria-disabled')).toBe('true')
  })

  it('names the pass and adds the rulers\' row on peyote (F-04-03, ticket 0972)', () => {
    const peyote = createProject({ technique: 'peyote', beadId: cubeBead.id, size: { width: 6, height: 14, unit: 'beads' } })
    const counter = strip(at(peyote, 2)).get(id('compact-position'))
    expect(counter.get('.row-progress__count-step').text()).toBe('Проход 3 из 27')
    expect(counter.get('.row-progress__line').text()).toBe('· столбец 2')
  })

  it('names the track after a column while rows run down the columns (F-04-05)', () => {
    const wrapper = strip(toggleRowDirection(makeProject(), frameIdIn(makeProject())))
    expect(wrapper.get(id('track')).attributes('aria-label')).toBe(ru.rowProgress.columnFinishedLabel)
  })

  it('gives its keys in a Tooltip and no native title (ticket 339)', () => {
    const wrapper = strip(at(makeProject(), 4))
    const keys = wrapper.findAll('.app-tooltip__key').map((chip) => chip.text())
    expect(keys).toContain('Enter')
    expect(keys).toContain('Shift+Enter')
    expect(keys.some((key) => key.includes('Space'))).toBe(false)
    expect(wrapper.find('[title]').exists()).toBe(false)
  })
})

describe('the settings list (MarginSheet card; tickets 0973, 455, 1251)', () => {
  const list = (wrapper: ReturnType<typeof strip>) => wrapper.find(id('direction-list'))
  const ways = (wrapper: ReturnType<typeof strip>) => list(wrapper).findAll('[role="radio"]')

  it('opens on the first press with the four ways in words, the current one checked, and turns nothing', async () => {
    const wrapper = strip(at(makeProject(), 4))
    const button = wrapper.get(id('settings'))
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
    const wrapper = strip(makeProject())
    const button = wrapper.get(id('settings'))

    await button.trigger('click')
    await wrapper.get(id('direction-up')).trigger('click')
    expect(wrapper.emitted('set-row-direction')).toEqual([['up']])
    expect(list(wrapper).exists()).toBe(false)

    await button.trigger('click')
    await wrapper.get(id('direction-down')).trigger('click')
    expect(wrapper.emitted('set-row-direction')).toHaveLength(1)

    await button.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(list(wrapper).exists()).toBe(false)
    expect(wrapper.emitted('set-row-direction')).toHaveLength(1)
    wrapper.unmount()
  })

  it('checks the way the rows run as the Frame lies', async () => {
    const wrapper = strip(toggleRowDirection(makeProject(), frameIdIn(makeProject())))
    await wrapper.get(id('settings')).trigger('click')
    expect(ways(wrapper).map((way) => way.attributes('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
    wrapper.unmount()
  })

  it('holds Row highlight as the Switch Show row marks, the strip having none of its own', async () => {
    const wrapper = strip(makeProject())
    expect(wrapper.find(id('highlight')).exists()).toBe(false)

    await wrapper.get(id('settings')).trigger('click')
    const marks = () => wrapper.get(id('row-marks'))
    expect(marks().attributes('role')).toBe('switch')
    expect(marks().attributes('aria-checked')).toBe('true')
    expect(marks().attributes('aria-label')).toBe(ru.rowProgress.showRowMarks)

    await wrapper.setProps({ rowHighlight: false })
    expect(marks().attributes('aria-checked')).toBe('false')
    await marks().trigger('click')
    expect(wrapper.emitted('toggle-row-highlight')).toHaveLength(1)
    // The list stays open, so the beader sees the marks come back.
    expect(list(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })

  it('asks to reset progress from its list, and closes it (ticket 455)', async () => {
    const wrapper = strip(at(makeProject(), 4))
    await wrapper.get(id('settings')).trigger('click')

    await wrapper.get(id('reset')).trigger('click')

    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
    expect(list(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps Reset progress off while no row is done', async () => {
    const wrapper = strip(makeProject())
    await wrapper.get(id('settings')).trigger('click')

    const reset = wrapper.get(id('reset'))
    expect(reset.attributes('aria-disabled')).toBe('true')
    await reset.trigger('click')
    expect(wrapper.emitted('reset-progress')).toBeUndefined()
    wrapper.unmount()
  })

  it('has no ways on a Custom frame, whose rows run one way, but still Show row marks and Reset progress', async () => {
    const placed = changeFrame(makeProject(), { custom: { shape: 'triangle', size: 4, centre: { row: 10, column: 10 } } }, frameIdIn(makeProject()))
    if (placed.kind !== 'changed') throw new Error('expected a Triangle')
    const wrapper = strip(at(placed.project, 2))
    expect(wrapper.get(id('compact-position')).text()).toContain('Круг 3 из 4')

    await wrapper.get(id('settings')).trigger('click')
    expect(ways(wrapper)).toHaveLength(0)
    expect(wrapper.find(id('row-marks')).exists()).toBe(true)
    expect(wrapper.find(id('reset')).exists()).toBe(true)
    wrapper.unmount()
  })

  it('names a Star\'s part and its joins, and a Fringe earring\'s strands, in the counter (tickets 0594, 0597)', () => {
    const spoken = (project: Project) => strip(project).get(id('compact-position')).text().replace(/\s+/g, ' ')
    const star = changeFrame(makeProject(), { custom: { shape: 'star', size: 3, centre: { row: 10, column: 10 } } }, frameIdIn(makeProject()))
    if (star.kind !== 'changed') throw new Error('expected a Star')
    expect(spoken(at(star.project, 4))).toContain('Часть 2, круг 2')
    expect(spoken(at(star.project, 15))).toContain('Сшить 1–2')

    const settings = { topWidth: 5, topRows: 4, fringeStyle: 'straight', fringeLength: 6 } as const
    const earring = changeFrame(makeProject(), { custom: { shape: 'fringeEarring', settings, centre: { row: 10, column: 10 } } }, frameIdIn(makeProject()))
    if (earring.kind !== 'changed') throw new Error('expected a Fringe earring')
    expect(spoken(at(earring.project, 6))).toContain('Нить 3')
  })
})

describe('Reset progress and Show row marks on the strip (ticket 1256)', () => {
  it('asks to reset through the list’s own event, and is off until a row is done', async () => {
    const fresh = strip(makeProject())
    expect(fresh.get(id('strip-reset')).attributes('aria-disabled')).toBe('true')
    await fresh.get(id('strip-reset')).trigger('click')
    expect(fresh.emitted('reset-progress')).toBeUndefined()
    expect(fresh.text()).toContain(ru.tooltips.noProgressToReset)

    const woven = strip(at(makeProject(), 4))
    expect(woven.get(id('strip-reset')).attributes('aria-label')).toBe(ru.rowProgress.resetButton)
    await woven.get(id('strip-reset')).trigger('click')
    expect(woven.emitted('reset-progress')).toHaveLength(1)
  })

  it('shows Show row marks pressed while the marks are drawn, and toggles them', async () => {
    const wrapper = strip(makeProject())
    const marks = wrapper.get(id('strip-marks'))
    expect(marks.attributes('aria-label')).toBe(ru.rowProgress.showRowMarks)
    expect(marks.attributes('aria-pressed')).toBe('true')
    expect(marks.classes()).toContain('icon-btn--selected')

    await marks.trigger('click')
    expect(wrapper.emitted('toggle-row-highlight')).toHaveLength(1)

    await wrapper.setProps({ rowHighlight: false })
    expect(marks.attributes('aria-pressed')).toBe('false')
    expect(marks.classes()).not.toContain('icon-btn--selected')
  })

  it('draws a mouse’s compact strip with Back a row and Row done as arrows alone, their names kept', () => {
    const wrapper = strip(at(makeProject(), 4), { compact: 'mouse' })
    for (const [name, label] of [['previous', ru.rowProgress.previousButton], ['next', ru.rowProgress.nextButton]] as const) {
      expect(wrapper.get(id(name)).attributes('aria-label')).toBe(label)
    }
    expect(wrapper.get(id('previous')).text()).toBe('')
    expect(wrapper.get(id('next')).classes()).toContain('row-progress__done--icon')
  })

  it('keeps Row done’s words on a compact strip under a finger, where there is room', () => {
    const wrapper = strip(at(makeProject(), 4), { compact: 'touch' })
    expect(wrapper.get(id('previous')).text()).toBe('')
    expect(wrapper.get(id('next')).classes()).not.toContain('row-progress__done--icon')
  })
})

describe('the track’s spark (ProgressBar card, ticket 0730)', () => {
  const project = makeProject()
  const press = (n: number, done: boolean): RowPress => ({ id: n, frame: frameIdIn(project), done, from: 0, to: 1, patternDone: false })
  const spark = (wrapper: ReturnType<typeof strip>) => wrapper.find(id('spark'))

  it('is hidden before the first pass, rides the fill’s edge after it and stays at the end once every pass is done', async () => {
    const wrapper = strip(project)
    expect(spark(wrapper).attributes('hidden')).toBeDefined()

    await wrapper.setProps({ project: at(project, 1) })
    expect(spark(wrapper).attributes('hidden')).toBeUndefined()
    expect(spark(wrapper).attributes('style')).toContain(`translateX(${(1 / 20 - 1) * 100}%)`)

    await wrapper.setProps({ project: at(project, 20) })
    expect(spark(wrapper).attributes('hidden')).toBeUndefined()
    expect(spark(wrapper).attributes('style')).toContain('translateX(0%)')
  })

  it('flares on each Row done, restarting each time, and not on Back a row or on being shown', async () => {
    const wrapper = strip(at(project, 1), { rowPress: press(1, true) })
    expect(spark(wrapper).classes().filter((name) => name.includes('flaring'))).toEqual([])

    await wrapper.setProps({ rowPress: press(2, true) })
    expect(spark(wrapper).classes()).toContain('progress-track__spark--flaring')
    await wrapper.setProps({ rowPress: press(3, true) })
    expect(spark(wrapper).classes()).toContain('progress-track__spark--flaring-alt')
    await wrapper.setProps({ rowPress: press(4, false) })
    expect(spark(wrapper).classes()).toContain('progress-track__spark--flaring-alt')
    expect(spark(wrapper).classes()).toContain('progress-track__spark--compact')
    expect(spark(wrapper).classes()).toContain('progress-track__spark--glints')
  })
})

describe('the Homepage cuff’s strip (ticket 1157, 1223)', () => {
  it('is the same strip with the counter as plain text, nothing to open, and Enter left to the page', () => {
    const wrapper = strip(at(makeProject(), 4), { form: 'woven', testid: 'welcome-cuff' })
    const counter = wrapper.get('[data-testid="welcome-cuff-compact-position"]')
    expect(counter.element.tagName).toBe('P')
    expect(wrapper.find('[data-testid="welcome-cuff-previous"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="welcome-cuff-next"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="welcome-cuff-strip-reset"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="welcome-cuff-strip-marks"]').exists()).toBe(false)
    expect(wrapper.findAll('.app-tooltip__key')).toHaveLength(0)
  })
})
