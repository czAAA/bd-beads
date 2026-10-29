import { test, type CDPSession, type Page } from '@playwright/test'
import type { GridPosition } from '../../src/domain/grid'
import type { Project } from '../../src/domain/project'
import type { Rect } from '../../src/domain/canvas'
import type { Technique } from '../../src/domain/weave'
import { copySelection, openApp, projectBox, selectTool, setZoom, settle } from '../support/app'
import { beadCentre } from '../support/projects'
import { canvasFixtures, isGround, type CanvasFixture, type Scenario } from './canvasFixtures'
import { attribution, busyMs, longFramesSince, metricMs, pageNow, startFrameCounter, stopFrameCounter, throttle, watchLongFrames, type LongFrame } from './measure'

// The big-Canvas performance check (ticket 0673), by hand with `npm run perf`: scattered Pieces, one huge Piece, a Frame
// over a full Canvas and a big library, each scenario printed against its budget. Env: PERF_SLOWDOWNS (4,6),
// PERF_TECHNIQUES (loom,peyote), PERF_FIXTURES (scattered, piece, …), PERF_ONLY (stroke, pan, edits, …).

const SLOWDOWNS = (process.env.PERF_SLOWDOWNS ?? '4,6').split(',').map(Number)
const TECHNIQUES = (process.env.PERF_TECHNIQUES ?? 'loom,peyote').split(',') as Technique[]
const FIXTURES = process.env.PERF_FIXTURES?.split(',')
const ONLY = process.env.PERF_ONLY?.split(',')

/** How long a stroke, a pan or a hover runs. */
const RUN_MS = 2000
/** Budgets ("Canvas performance for large patterns", after RAIL): script per pointer move, and one edit's response. */
const MOVE_BUDGET_MS = 8
const EDIT_BUDGET_MS = 100
/** How long an edit is given after its frame to finish what it set going later (a save, a summary's 250 ms catch-up). */
const AFTERMATH_MS = 300
/** How many beads along the target a hover's next move skips, so a sweep crosses the block, not one corner of it. */
const SWEEP_STRIDE = 7

interface Result {
  slowdown: number
  technique: Technique
  fixture: string
  what: string
  /** A pointer run: how many moves it made, the frame rate, and the script time per move. */
  run?: { moves: number; fps: number; scriptPerMove: number }
  /** A one-off edit: main-thread busy time from the input until it has settled. */
  ms?: number
  /** The long animation frames in it; undefined where the browser does not report them. */
  longFrames: LongFrame[] | undefined
  note?: string
}
const results: Result[] = []
/** Keeps what a scenario measured, under its name. */
type Recorder = (what: string, measured: Omit<Result, 'slowdown' | 'technique' | 'fixture' | 'what'>) => void

/** Where a Canvas position is on screen, at the view as it stands now. */
async function screenOf(page: Page, project: Project): Promise<(position: GridPosition) => { x: number; y: number }> {
  const surface = page.getByTestId('project-surface')
  const zoom = Number(await surface.getAttribute('data-zoom'))
  const box = await projectBox(page, (await surface.boundingBox())!)
  return (position) => beadCentre(project, box, zoom, position)
}

/** The target's positions bead by bead, row after row, turning back at each row's end as a hand would. */
function serpentine(target: Rect, index: number): GridPosition {
  const along = index % (target.columns * target.rows)
  const row = Math.floor(along / target.columns)
  const step = along % target.columns
  return { row: target.row + row, column: target.column + (row % 2 === 0 ? step : target.columns - 1 - step) }
}

/** Runs `step` (the pointer's moves) for RUN_MS, at least once, and measures it. */
async function pointerRun(page: Page, cdp: CDPSession, step: (index: number) => Promise<void>): Promise<Pick<Result, 'run' | 'longFrames'>> {
  await settle(page)
  const since = await pageNow(page)
  const scriptBefore = await metricMs(cdp, 'ScriptDuration')
  await startFrameCounter(page)
  const started = Date.now()
  let moves = 0
  while (moves === 0 || Date.now() - started < RUN_MS) {
    await step(moves)
    moves += 1
  }
  const elapsed = (Date.now() - started) / 1000
  const frames = await stopFrameCounter(page)
  const script = (await metricMs(cdp, 'ScriptDuration')) - scriptBefore
  return { run: { moves, fps: frames / elapsed, scriptPerMove: script / moves }, longFrames: await longFramesSince(page, since) }
}

/** Sweeps the pointer across the target for RUN_MS, button held or not, and measures it. */
async function sweep(page: Page, cdp: CDPSession, at: (position: GridPosition) => { x: number; y: number }, target: Rect): Promise<Pick<Result, 'run' | 'longFrames'>> {
  return pointerRun(page, cdp, (index) => {
    const next = at(serpentine(target, index * SWEEP_STRIDE))
    return page.mouse.move(next.x, next.y)
  })
}

/** Does one edit and measures it, aftermath included. */
async function oneOff(page: Page, cdp: CDPSession, act: () => Promise<void>): Promise<Pick<Result, 'ms' | 'longFrames'>> {
  await settle(page)
  const since = await pageNow(page)
  const before = await busyMs(cdp)
  await act()
  await settle(page)
  await page.waitForTimeout(AFTERMATH_MS)
  return { ms: (await busyMs(cdp)) - before, longFrames: await longFramesSince(page, since) }
}

/** A ground bead on the target's last row, which the stroke (from its first row) never reaches: a Fill there floods
 * the Piece's ground. */
function groundIn(target: Rect): GridPosition {
  for (let index = 0; ; index += 1) {
    const position = { row: target.row + target.rows - 1, column: target.column + 2 + index }
    if (isGround(position.row, position.column)) return position
  }
}

/** The steps of each scenario; each pushes what it measured and leaves the view at the fit, Paint in hand. */
const SCENARIOS: Record<Scenario, (page: Page, cdp: CDPSession, fixture: CanvasFixture, record: Recorder) => Promise<void>> = {
  async stroke(page, cdp, { library, target }, record) {
    const at = await screenOf(page, library[0]!)
    const start = at(serpentine(target, 0))
    await page.mouse.move(start.x, start.y)
    const stroke = await pointerRun(page, cdp, async (index) => {
      if (index === 0) return page.mouse.down()
      const next = at(serpentine(target, index))
      await page.mouse.move(next.x, next.y)
    })
    record('stroke', { ...stroke, note: 'one bead a move' })
    record('stroke end', await oneOff(page, cdp, () => page.mouse.up()))
  },

  async pan(page, cdp, _fixture, record) {
    const surface = (await page.getByTestId('project-surface').boundingBox())!
    const middle = { x: surface.x + surface.width / 2, y: surface.y + surface.height / 2 }
    for (const zoom of ['fit', 100] as const) {
      if (zoom === 100) await setZoom(page, 100)
      await selectTool(page, 'hand')
      await page.mouse.move(middle.x, middle.y)
      await page.mouse.down()
      // Side to side, 300 px each way in 10 px moves.
      const pan = await pointerRun(page, cdp, (index) => {
        const phase = index % 60
        return page.mouse.move(middle.x + 10 * (phase < 30 ? phase - 15 : 45 - phase), middle.y)
      })
      await page.mouse.up()
      record(`pan ${zoom === 'fit' ? 'at fit' : 'at 100%'}`, { ...pan, note: `at ${await page.getByTestId('project-surface').getAttribute('data-zoom')} zoom` })
    }
    await selectTool(page, 'paint')
    await page.getByTestId('zoom-reset').click()
    await settle(page)
  },

  async edits(page, cdp, { library, target }, record) {
    const at = await screenOf(page, library[0]!)
    await selectTool(page, 'fill')
    const ground = at(groundIn(target))
    record('fill', { ...(await oneOff(page, cdp, () => page.mouse.click(ground.x, ground.y))), note: 'floods the ground' })

    // A 10 × 10 block copied from the target's corner and stamped further in.
    await selectTool(page, 'select')
    const from = at({ row: target.row + 2, column: target.column + 2 })
    const to = at({ row: target.row + 11, column: target.column + 11 })
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 4 })
    await page.mouse.up()
    await copySelection(page)
    const stamp = at({ row: target.row + 20, column: target.column + 20 })
    await page.mouse.move(stamp.x, stamp.y)
    record('paste', { ...(await oneOff(page, cdp, () => page.mouse.click(stamp.x, stamp.y))), note: '10×10 block' })
    record('undo', { ...(await oneOff(page, cdp, () => page.keyboard.press('ControlOrMeta+z'))), note: 'the paste' })
    await page.keyboard.press('Escape')
    await selectTool(page, 'paint')
  },

  async 'paste hover'(page, cdp, { library, target }, record) {
    // Select all takes the rectangle round every bead: the whole 300 × 300 block is copied.
    await selectTool(page, 'select')
    await page.keyboard.press('ControlOrMeta+a')
    await settle(page)
    await copySelection(page)
    const at = await screenOf(page, library[0]!)
    record('paste hover', { ...(await sweep(page, cdp, at, target)), note: '300×300 block' })
    const stamp = at({ row: target.row + 10, column: target.column + 10 })
    record('paste', { ...(await oneOff(page, cdp, () => page.mouse.click(stamp.x, stamp.y))), note: '300×300 block' })
    record('undo', { ...(await oneOff(page, cdp, () => page.keyboard.press('ControlOrMeta+z'))), note: 'the paste' })
    await page.keyboard.press('Escape')
    await selectTool(page, 'paint')
  },

  async 'shaped drag'(page, cdp, { library, target }, record) {
    // A Piece tool tap selects the 300 × 300 Piece's own beads; a shape has no handles, so the drag only sweeps it.
    const at = await screenOf(page, library[0]!)
    await selectTool(page, 'piece')
    const tap = at(serpentine(target, 0))
    record('piece tap', { ...(await oneOff(page, cdp, () => page.mouse.click(tap.x, tap.y))), note: '90,000-bead shape' })
    await page.mouse.move(tap.x, tap.y)
    await page.mouse.down()
    const drag = await sweep(page, cdp, at, target)
    await page.mouse.up()
    record('shaped drag', { ...drag, note: 'across the shaped Selection' })
    await selectTool(page, 'paint')
  },
}

for (const slowdown of SLOWDOWNS) {
  for (const technique of TECHNIQUES) {
    for (const fixture of canvasFixtures(technique).filter(({ name }) => !FIXTURES || FIXTURES.includes(name))) {
      const scenarios = fixture.scenarios.filter((name) => !ONLY || ONLY.includes(name))
      test(`${fixture.name} ${technique} at ${slowdown}× slowdown`, async ({ page }) => {
        // PERF_ONLY may name only the other perf spec's scenarios.
        test.skip(scenarios.length === 0, 'no scenario of this fixture is wanted')
        await watchLongFrames(page)
        await openApp(page, fixture.library)
        const cdp = await throttle(page, slowdown)
        await settle(page)
        const record: Recorder = (what, measured) => results.push({ slowdown, technique, fixture: fixture.name, what, ...measured })
        for (const scenario of scenarios) {
          await SCENARIOS[scenario](page, cdp, fixture, record)
        }
      })
    }
  }
}

/** What a result is held to: no long frame in a stroke, 8 ms of script a pointer move, 100 ms an edit. */
function verdict({ what, run, ms, longFrames }: Result): string {
  const over: string[] = []
  if (what === 'stroke' && longFrames && longFrames.length > 0) over.push('long frames')
  if (run && run.scriptPerMove > MOVE_BUDGET_MS) over.push(`script > ${MOVE_BUDGET_MS} ms`)
  if (ms !== undefined && ms > EDIT_BUDGET_MS) over.push(`> ${EDIT_BUDGET_MS} ms`)
  return over.length === 0 ? 'ok' : `OVER (${over.join(', ')})`
}

function line(result: Result): string {
  const { what, run, ms, longFrames, note } = result
  const measured = run
    ? `${String(run.moves).padStart(4)} moves ${run.fps.toFixed(0).padStart(3)} fps ${run.scriptPerMove.toFixed(1).padStart(7)} ms script/move`
    : `${(ms ?? 0).toFixed(0).padStart(31)} ms busy`
  const long = longFrames === undefined ? 'long frames n/a' : `${String(longFrames.length).padStart(3)} long frames${longFrames.length ? ` (max ${Math.round(Math.max(...longFrames.map((frame) => frame.duration)))} ms; ${attribution(longFrames)})` : ''}`
  return `${what.padEnd(12)} ${measured}  ${verdict(result).padEnd(28)} ${long}${note ? `  [${note}]` : ''}`
}

test.afterAll(() => {
  const lines = ['', `Big-Canvas performance check (production build; budgets: no long frame in a stroke, ${MOVE_BUDGET_MS} ms of script a pointer move, ${EDIT_BUDGET_MS} ms an edit)`, '']
  for (const slowdown of SLOWDOWNS) {
    lines.push(`── ${slowdown}× CPU slowdown ${'─'.repeat(60)}`)
    for (const technique of TECHNIQUES) {
      for (const fixture of [...new Set(results.filter((result) => result.slowdown === slowdown && result.technique === technique).map((result) => result.fixture))]) {
        lines.push(`${fixture} (${technique})`)
        for (const result of results.filter((each) => each.slowdown === slowdown && each.technique === technique && each.fixture === fixture)) {
          lines.push(`  ${line(result)}`)
        }
      }
    }
    lines.push('')
  }
  console.log(lines.join('\n'))
})
