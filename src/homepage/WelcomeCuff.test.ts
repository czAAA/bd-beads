import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { effectScope, nextTick, shallowRef } from 'vue'
import ProgressBar from '../components/canvas/ProgressBar.vue'
import ProjectSurface from '../components/canvas/ProjectSurface.vue'
import { useRowOps } from '../composables/project/useRowOps'
import { frameOf } from '../domain/layerRecord'
import type { Project } from '../domain/project'
import { rowPassesOf } from '../domain/rowProgress'
import { en } from '../i18n/en'
import { recordingContext } from '../testUtils/recordingContext'
import { cuffView } from './cuffView'
import { wovenCuff } from './inside/demoProjects'
import WelcomeCuff from './WelcomeCuff.vue'

/** Every Project the renderer was given to draw, the editor's and the cuff's alike. */
const drawn = vi.hoisted(() => ({ projects: [] as unknown[] }))
vi.mock('../rendering/projectRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../rendering/projectRenderer')>()
  return {
    ...actual,
    renderProject: (...args: Parameters<typeof actual.renderProject>) => {
      drawn.projects.push(args[1].project)
      return actual.renderProject(...args)
    },
  }
})

let context: ReturnType<typeof recordingContext>
beforeEach(() => {
  context = recordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context.context as unknown as CanvasRenderingContext2D)
  drawn.projects = []
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

/** The ruler numbers drawn on the current pass's `marker` pill since `from`: each right after its rounded pill. */
function pillNumbers(from: number): string[] {
  const calls = context.calls.slice(from)
  const pill = (index: number) => calls[index - 1]?.name === 'fill' && calls[index - 2]?.name === 'roundRect'
  return calls.flatMap((call, index) => (call.name === 'fillText' && pill(index) ? [String(call.args[0])] : []))
}

/** Which beads of the Frame are drawn finished in the last Project the renderer drew. */
function finishedBeads(): string[] {
  const project = drawn.projects.at(-1) as Project
  const { rows, columns } = frameOf(project)!
  const passes = rowPassesOf(project)
  const finished: string[] = []
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) if (passes(row, column) === 'finished') finished.push(`${row},${column}`)
  return finished
}

/** The Progress bar's counter as the person reads it in its words: its step and the rulers' row. */
const counterOf = (wrapper: ReturnType<typeof mount>, id: string) => {
  const counter = wrapper.get(`[data-testid="${id}-compact-position"]`)
  const part = (name: string) => counter.get(`.row-progress__count-${name}, .row-progress__woven-${name}`).text()
  const line = counter.get('.row-progress__line, .row-progress__woven-line').text()
  return `${part('step')} ${line}`.replace(/\s+/g, ' ')
}

describe('WelcomeCuff (ticket 1157)', () => {
  it("after N presses of Row done shows what the editor shows on the same Project after N Row done: one source", async () => {
    const PRESSES = 7
    const cuff = mount(WelcomeCuff, { props: { shown: false } })
    for (let press = 0; press < PRESSES; press++) await cuff.get('[data-testid="welcome-cuff-next"]').trigger('click')
    await nextTick()
    const cuffFinished = finishedBeads()
    const cuffPill = pillNumbers(0)

    // The editor: the same Project, Row done pressed as many times through its own Row progress controls' flow.
    const scope = effectScope()
    const editing = shallowRef(wovenCuff())
    const rows = scope.run(() => useRowOps({ currentProject: () => editing.value, replaceProject: (next) => (editing.value = next), showToast: () => {}, messages: () => en }))!
    for (let press = 0; press < PRESSES; press++) rows.onMoveRow(1)
    const bar = mount(ProgressBar, { props: { project: editing.value } })
    expect(counterOf(cuff, 'welcome-cuff')).toBe(counterOf(bar, 'progress-bar'))
    expect(counterOf(cuff, 'welcome-cuff')).toBe('Pass 8 of 95 · row 5')

    // The editor's Canvas round the same Frame, at 100%, where its margin sheet is whole and holds the Frame's numbers.
    const view = cuffView(editing.value, 1)
    const from = context.calls.length
    const surface = mount(ProjectSurface, {
      props: { project: editing.value, zoom: view.zoom, scroll: view.scroll },
      attrs: { style: `width: ${view.size.width}px; height: ${view.size.height}px` },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    expect(cuffPill.at(-1)).toBe('5')
    expect(pillNumbers(from).at(-1)).toBe(cuffPill.at(-1))
    expect(cuffFinished.length).toBeGreaterThan(0)
    expect(finishedBeads()).toEqual(cuffFinished)
    surface.unmount()
    scope.stop()
  })

  it("is named for screen readers with the counter's words, and says a press as the editor does", async () => {
    const cuff = mount(WelcomeCuff, { props: { shown: false } })
    const drawing = cuff.get('[data-testid="welcome-cuff-drawing"]')
    expect(drawing.attributes('role')).toBe('img')
    expect(drawing.attributes('aria-label')).toBe('Peacock feather cuff in peyote, being woven: Pass 1 of 95, row 1')
    await cuff.get('[data-testid="welcome-cuff-next"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(drawing.attributes('aria-label')).toBe('Peacock feather cuff in peyote, being woven: Pass 2 of 95, row 2')
    expect(cuff.get('[data-testid="welcome-cuff-announcer"]').text()).toBe('Pass 2 of 95, row 2')
  })

  it('holds the bar\'s counter, track and moves alone, Back a row disabled on the first pass, and no key of the editor\'s', () => {
    const cuff = mount(WelcomeCuff, { props: { shown: false } })
    for (const gone of ['direction', 'reset', 'highlight', 'position']) expect(cuff.find(`[data-testid="welcome-cuff-${gone}"]`).exists(), gone).toBe(false)
    expect(cuff.find('[data-testid="welcome-cuff-track"]').exists()).toBe(true)
    expect(cuff.get('[data-testid="welcome-cuff-previous"]').attributes('aria-disabled')).toBe('true')
    expect(cuff.get('[data-testid="welcome-cuff-next"]').text()).toBe('Row done')
    expect(cuff.find('kbd').exists()).toBe(false)
  })

  it('saves nothing: the library and the device settings stay as they were', async () => {
    const cuff = mount(WelcomeCuff, { props: { shown: false } })
    await cuff.get('[data-testid="welcome-cuff-next"]').trigger('click')
    await cuff.get('[data-testid="welcome-cuff-previous"]').trigger('click')
    expect(localStorage.length).toBe(0)
  })
})
