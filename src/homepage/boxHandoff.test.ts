import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOX_HANDOFF_KEY, growIntoEditor, leaveWithBox } from './boxHandoff'

const root = document.documentElement

/** A page whose browser can run View Transitions, asking for motion or not. */
function withTransitions(reducedMotion = false) {
  Object.assign(document, { startViewTransition: vi.fn() })
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reducedMotion && query.includes('reduce') }))
}

function homepageBox(x = 160, y = 10, width = 1120, height = 880): HTMLElement {
  const box = document.createElement('div')
  box.getBoundingClientRect = () => ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) })
  document.body.append(box)
  return box
}

const SIDES = ['x', 'y', 'width', 'height']

/** Nothing handed over and nothing opted in: the page navigates, or arrives, as it always did. */
function expectPlainPage() {
  expect(sessionStorage.getItem(BOX_HANDOFF_KEY)).toBeNull()
  expect(root.dataset.handoff).toBeUndefined()
  expect(document.head.querySelector('style[data-handoff]')).toBeNull()
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  delete (document as Partial<Document>).startViewTransition
  vi.unstubAllGlobals()
  delete root.dataset.handoff
  document.head.querySelectorAll('style[data-handoff]').forEach((style) => style.remove())
  document.body.replaceChildren()
})

describe('leaving the Homepage for the editor (ticket 0776)', () => {
  it('remembers where the canvas box stands and opts this page into the transition', () => {
    withTransitions()
    leaveWithBox(homepageBox(160.4, 10, 1120, 879.6))

    expect(JSON.parse(sessionStorage.getItem(BOX_HANDOFF_KEY)!)).toEqual({ x: 160, y: 10, width: 1120, height: 880 })
    expect(root.dataset.handoff).toBe('leaving')
    expect(document.head.querySelector('style[data-handoff]')?.textContent).toContain('@view-transition')
  })

  it.each([
    ['the beader asks for reduced motion', () => withTransitions(true)],
    ['the browser has no View Transitions', () => vi.stubGlobal('matchMedia', () => ({ matches: false }))],
  ])('is a plain navigation when %s', (_, setUp) => {
    setUp()
    leaveWithBox(homepageBox())

    expectPlainPage()
  })

  it('is undone when Back brings the Homepage back from the browser cache', () => {
    withTransitions()
    leaveWithBox(homepageBox())
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))

    expectPlainPage()
  })
})

/** The editor's arrival script, as index.html runs it before the first paint. */
function runArrivalScript() {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const code = /<script data-handoff>([\s\S]*?)<\/script>/.exec(html)
  if (!code) throw new Error('index.html has no <script data-handoff>')
  new Function(code[1])()
}

describe('arriving in the editor from the Homepage (ticket 0776)', () => {
  afterEach(() => {
    for (const side of SIDES) root.style.removeProperty(`--handoff-${side}`)
    delete window.openbeadsHandoff
    vi.useRealTimers()
  })

  it('draws the empty box where the Homepage left it and opts this page into the transition, once', () => {
    withTransitions()
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify({ x: 160, y: 10, width: 1120, height: 880 }))
    runArrivalScript()

    expect(root.dataset.handoff).toBe('arriving')
    expect(SIDES.map((side) => root.style.getPropertyValue(`--handoff-${side}`))).toEqual(['160px', '10px', '1120px', '880px'])
    expect(document.head.querySelector('style[data-handoff]')?.textContent).toContain('@view-transition')
    expect(sessionStorage.getItem(BOX_HANDOFF_KEY)).toBeNull()
  })

  it("keeps the browser's cross-fade for the box to wait on", () => {
    withTransitions()
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify({ x: 160, y: 10, width: 1120, height: 880 }))
    runArrivalScript()
    const crossFade = { finished: Promise.resolve(undefined) } as ViewTransition
    window.dispatchEvent(Object.assign(new Event('pagereveal'), { viewTransition: crossFade }))

    expect(window.openbeadsHandoff).toBe(crossFade)
  })

  it('gives the page back to the splash when the app never mounts', () => {
    vi.useFakeTimers()
    withTransitions()
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify({ x: 160, y: 10, width: 1120, height: 880 }))
    runArrivalScript()
    vi.advanceTimersByTime(4000)

    expect(root.dataset.handoff).toBeUndefined()
  })

  it.each([
    ['nothing was handed over', undefined, () => withTransitions()],
    ['what was handed over is not a box', '{"x":"left"}', () => withTransitions()],
    ['the browser has no View Transitions', '{"x":1,"y":2,"width":3,"height":4}', () => {}],
    ['the beader asks for reduced motion', '{"x":1,"y":2,"width":3,"height":4}', () => withTransitions(true)],
  ])('is a plain arrival when %s', (_, stored, setUp) => {
    setUp()
    if (stored) sessionStorage.setItem(BOX_HANDOFF_KEY, stored)
    runArrivalScript()

    expectPlainPage()
  })
})

describe('the box growing into the editor once it mounts (ticket 0776)', () => {
  /** A browser that runs the update at once and finishes the transition when `finish` is called. */
  function transitions() {
    let finish = () => {}
    const finished = new Promise<void>((done) => (finish = done))
    const start = vi.fn((update: () => void) => {
      update()
      return { finished }
    })
    Object.assign(document, { startViewTransition: start })
    return { start, finish: () => finish() }
  }

  function arrived() {
    root.dataset.handoff = 'arriving'
    const placeholder = document.createElement('div')
    placeholder.id = 'handoff'
    document.body.append(placeholder)
  }

  afterEach(() => {
    delete window.openbeadsHandoff
  })

  it('grows the empty box into the editor, then lets the page be', async () => {
    const { start, finish } = transitions()
    arrived()
    const grown = growIntoEditor()
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce())

    expect(document.getElementById('handoff')).toBeNull()
    expect(root.dataset.handoff).toBe('growing')
    finish()
    await grown
    expect(root.dataset.handoff).toBeUndefined()
  })

  it('waits for the cross-fade from the Homepage to end before growing', async () => {
    const { start } = transitions()
    let crossFaded = () => {}
    window.openbeadsHandoff = { finished: new Promise<undefined>((done) => (crossFaded = () => done(undefined))) } as ViewTransition
    arrived()
    void growIntoEditor()
    await new Promise((settled) => setTimeout(settled))

    expect(start).not.toHaveBeenCalled()
    crossFaded()
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce())
  })

  it('does nothing when the editor was not opened from the Homepage', async () => {
    const { start } = transitions()
    await growIntoEditor()

    expect(start).not.toHaveBeenCalled()
  })
})
