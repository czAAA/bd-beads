import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOX_HANDOFF_KEY, growIntoEditor, leaveWithBox, type BoxHandoff } from './boxHandoff'

const root = document.documentElement

/** A page whose browser can run View Transitions, asking for motion or not. */
function withTransitions(reducedMotion = false) {
  Object.assign(document, { startViewTransition: vi.fn() })
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reducedMotion && query.includes('reduce') }))
}

function rectOf(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON: () => ({}) }
}

const MARKS = 'url("data:image/png;base64,AAAA")'

/** The Homepage's canvas box: its Canvas strip, then the drawing area its content stands on, over the marks. */
function homepageBox(x = 160, y = 10, width = 1120, height = 880): HTMLElement {
  const box = document.createElement('div')
  box.getBoundingClientRect = () => rectOf(x, y, width, height)
  box.innerHTML =
    '<div class="canvas-strip" data-v-strip><span>Menu</span></div><div class="homepage__body"><main class="homepage__page"><button>Open</button></main></div>'
  const body = box.querySelector<HTMLElement>('.homepage__body')!
  body.getBoundingClientRect = () => rectOf(x, y + 46, width, height - 46 - 40)
  body.style.backgroundImage = MARKS
  body.style.backgroundSize = '14px 12px'
  body.style.backgroundColor = 'rgb(20, 20, 20)'
  document.body.append(box)
  return box
}

const handedOver = (): BoxHandoff => JSON.parse(sessionStorage.getItem(BOX_HANDOFF_KEY)!)

function transitionEnd(target: Element, propertyName: string) {
  target.dispatchEvent(Object.assign(new Event('transitionend', { bubbles: true }), { propertyName }))
}

const SIDES = ['x', 'y', 'width', 'height', 'bodyY', 'bodyHeight', 'marks', 'tile', 'bg']

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
  vi.useRealTimers()
  delete root.dataset.handoff
  document.head.querySelectorAll('style[data-handoff]').forEach((style) => style.remove())
  document.body.replaceChildren()
})

describe('leaving the Homepage for the editor (tickets 0776, 0783)', () => {
  it('hands over where the canvas box stands, its strip and its marks, and opts this page into the transition', () => {
    vi.useFakeTimers()
    withTransitions()
    void leaveWithBox(homepageBox(160.4, 10, 1120, 879.6))

    expect(handedOver()).toEqual({
      x: 160,
      y: 10,
      width: 1120,
      height: 880,
      strip: '<div class="canvas-strip" data-v-strip=""><span>Menu</span></div>',
      bodyY: 46,
      bodyHeight: 794,
      marks: MARKS,
      tile: '14px 12px',
      bg: 'rgb(20, 20, 20)',
    })
    expect(root.dataset.handoff).toBe('leaving')
    expect(document.head.querySelector('style[data-handoff]')?.textContent).toContain('@view-transition')
  })

  it("resolves once the content's fade has ended, not on a button's own, so the navigation follows the fade", async () => {
    vi.useFakeTimers()
    withTransitions()
    const box = homepageBox()
    const page = box.querySelector('.homepage__page')!
    let left = false
    void leaveWithBox(box).then(() => (left = true))
    transitionEnd(page.querySelector('button')!, 'opacity')
    transitionEnd(page, 'transform')
    await vi.advanceTimersByTimeAsync(0)
    expect(left).toBe(false)

    transitionEnd(page, 'opacity')
    await vi.advanceTimersByTimeAsync(0)
    expect(left).toBe(true)
  })

  it('leaves anyway, a grace after the fade, when the browser fires no transitionend', async () => {
    vi.useFakeTimers()
    withTransitions()
    root.style.setProperty('--duration-base', '200ms')
    let left = false
    void leaveWithBox(homepageBox()).then(() => (left = true))
    await vi.advanceTimersByTimeAsync(299)
    expect(left).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(left).toBe(true)
    root.style.removeProperty('--duration-base')
  })

  it('joins a leave already under way instead of handing over twice', async () => {
    vi.useFakeTimers()
    withTransitions()
    const box = homepageBox()
    const first = leaveWithBox(box)

    expect(leaveWithBox(box)).toBe(first)
    expect(document.head.querySelectorAll('style[data-handoff]')).toHaveLength(1)
  })

  it('is a plain navigation when the box has no strip or no drawing area to hand over', async () => {
    withTransitions()
    const box = homepageBox()
    box.querySelector('.canvas-strip')!.remove()
    await leaveWithBox(box)

    expectPlainPage()
  })

  it.each([
    ['the beader asks for reduced motion', () => withTransitions(true)],
    ['the browser has no View Transitions', () => vi.stubGlobal('matchMedia', () => ({ matches: false }))],
  ])('is a plain navigation, at once, when %s', async (_, setUp) => {
    setUp()
    await leaveWithBox(homepageBox())

    expectPlainPage()
  })

  it('is undone when Back brings the Homepage back from the browser cache', () => {
    vi.useFakeTimers()
    withTransitions()
    void leaveWithBox(homepageBox())
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))

    expectPlainPage()
  })
})

const HANDOFF: BoxHandoff = {
  x: 160,
  y: 10,
  width: 1120,
  height: 880,
  strip: '<div class="canvas-strip"><span>Menu</span></div>',
  bodyY: 46,
  bodyHeight: 794,
  marks: MARKS,
  tile: '14px 12px',
  bg: 'rgb(20, 20, 20)',
}

/** The editor's arrival script, as index.html runs it after the placeholder, before the first paint. */
function runArrivalScript() {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const code = /<script data-handoff>([\s\S]*?)<\/script>/.exec(html)
  const placeholder = /<div id="handoff"[^>]*>[\s\S]*?<\/div><\/div>/.exec(html)
  if (!code || !placeholder) throw new Error('index.html has no <script data-handoff> after its #handoff')
  document.body.insertAdjacentHTML('afterbegin', placeholder[0])
  new Function(code[1])()
}

describe('arriving in the editor from the Homepage (tickets 0776, 0783)', () => {
  afterEach(() => {
    for (const side of SIDES) root.style.removeProperty(`--handoff-${side}`)
    delete window.openbeadsHandoff
  })

  it('draws the box where the Homepage left it, with its strip and marks, and opts this page into the transition, once', () => {
    withTransitions()
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify(HANDOFF))
    runArrivalScript()

    expect(root.dataset.handoff).toBe('arriving')
    expect(SIDES.map((side) => root.style.getPropertyValue(`--handoff-${side}`))).toEqual([
      '160px', '10px', '1120px', '880px', '46px', '794px', MARKS, '14px 12px', 'rgb(20, 20, 20)',
    ])
    expect(document.querySelector('#handoff > div > .canvas-strip')?.textContent).toBe('Menu')
    expect(document.querySelector('#handoff > div > .canvas-strip + i')).not.toBeNull()
    expect(document.getElementById('handoff')?.hasAttribute('inert')).toBe(true)
    expect(document.head.querySelector('style[data-handoff]')?.textContent).toContain('@view-transition')
    expect(sessionStorage.getItem(BOX_HANDOFF_KEY)).toBeNull()
  })

  it("keeps the browser's step across the page load for the box to wait on", () => {
    withTransitions()
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify(HANDOFF))
    runArrivalScript()
    const step = { finished: Promise.resolve(undefined) } as ViewTransition
    window.dispatchEvent(Object.assign(new Event('pagereveal'), { viewTransition: step }))

    expect(window.openbeadsHandoff).toBe(step)
  })

  it('gives the page back to the splash when the app never mounts', () => {
    vi.useFakeTimers()
    withTransitions()
    sessionStorage.setItem(BOX_HANDOFF_KEY, JSON.stringify(HANDOFF))
    runArrivalScript()
    vi.advanceTimersByTime(4000)

    expect(root.dataset.handoff).toBeUndefined()
  })

  it.each([
    ['nothing was handed over', undefined, () => withTransitions()],
    ['what was handed over is not a box', '{"x":"left"}', () => withTransitions()],
    ['what was handed over has no strip', JSON.stringify({ ...HANDOFF, strip: undefined }), () => withTransitions()],
    ['what was handed over has no marks', JSON.stringify({ ...HANDOFF, marks: 7 }), () => withTransitions()],
    ['the browser has no View Transitions', JSON.stringify(HANDOFF), () => {}],
    ['the beader asks for reduced motion', JSON.stringify(HANDOFF), () => withTransitions(true)],
  ])('is a plain arrival when %s', (_, stored, setUp) => {
    setUp()
    if (stored) sessionStorage.setItem(BOX_HANDOFF_KEY, stored)
    runArrivalScript()

    expectPlainPage()
    expect(document.querySelector('#handoff .canvas-strip')).toBeNull()
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

  it('grows the handed-over box into the editor, then lets the page be', async () => {
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

  it("waits for the browser's step across the page load to end before growing", async () => {
    const { start } = transitions()
    let stepped = () => {}
    window.openbeadsHandoff = { finished: new Promise<undefined>((done) => (stepped = () => done(undefined))) } as ViewTransition
    arrived()
    void growIntoEditor()
    await new Promise((settled) => setTimeout(settled))

    expect(start).not.toHaveBeenCalled()
    stepped()
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce())
  })

  it('does nothing when the editor was not opened from the Homepage', async () => {
    const { start } = transitions()
    await growIntoEditor()

    expect(start).not.toHaveBeenCalled()
  })
})
