import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProjectSurface from './ProjectSurface.vue'
import { createProject, type Project, type RowProgress, type Technique, frameGrid, withFrameGrid } from '../../domain/project'
import { DARK_THEME, DEFAULT_THEME, fadeOver } from '../../rendering/beadLook'
import { OPEN_SPACE } from '../../rendering/space'
import { recordingContext } from '../../testUtils/recordingContext'
import { surfaceView } from '../../rendering/surfaceView'

/** A Project of this many beads, with any of its fields changed. */
/** A Project whose Frame is `columns` × `rows` at the origin, holding the `beads` given (the Frame's own, ADR 0066). */
function projectOf(columns: number, rows: number, extra: Partial<Project> = {}, technique: Technique = 'loom'): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  const { beads, ...rest } = extra
  // Left out the Frame is the usual one; `frame: undefined` is a Canvas with none, and its beads are the Canvas's.
  if ('frame' in extra && extra.frame === undefined) {
    const { frame: _frame, ...open } = project
    return { ...open, ...rest, beads: beads ?? {} }
  }
  return { ...project, ...rest, frame: { ...project.frame!, ...rest.frame, beads: beads ?? {} } }
}

/** How big the drawing area is on the screen. jsdom does no layout, so it is said here. */
const VIEWPORT = { width: 1000, height: 800 }

let viewport = VIEWPORT
let context: ReturnType<typeof recordingContext>

function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
}

beforeEach(() => {
  viewport = VIEWPORT
  context = recordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context.context as unknown as CanvasRenderingContext2D)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.classList.contains('project-surface') ? rectOf(0, 0, viewport.width, viewport.height) : rectOf(0, 0, 0, 0)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Mounts the surface over a drawing area of the given size, looking at the canvas from `scroll` at `zoom`. */
async function mountSurface(project: Project, zoom = 1, scroll = { x: 0, y: 0 }, extra: Record<string, unknown> = {}) {
  const wrapper = mount(ProjectSurface, { props: { project, zoom, scroll, ...extra }, attachTo: document.body })
  // The canvases are drawn once they have their size.
  await nextTick()
  await nextTick()
  return { wrapper }
}

/** Times the surface has been drawn: each draws the beads and then the overlay, and each starts by clearing. */
const draws = () => context.named('clearRect').length / 2

describe('ProjectSurface', () => {
  it('redraws each layer once per animation frame, with the last zoom and scroll, however many changes come first', async () => {
    const frames: (() => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    const { wrapper } = await mountSurface(projectOf(20, 10), 1)
    frames.splice(0).forEach((frame) => frame())
    context.calls.length = 0

    for (const zoom of [0.9, 0.8, 0.7, 0.6]) {
      await wrapper.setProps({ zoom, scroll: { x: zoom * 10, y: 0 } })
    }
    expect(draws()).toBe(0)
    frames.splice(0).forEach((frame) => frame())

    expect(draws()).toBe(1)
    expect(wrapper.attributes('data-zoom')).toBe('0.6')
  })

  it('moves the drawn beads of a very large piece while the canvas is zoomed, and draws them sharp once it settles (ticket 349)', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0))
      vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
      const { wrapper } = await mountSurface(projectOf(300, 300), 0.2)
      vi.advanceTimersByTime(10)
      const cells = wrapper.find<HTMLCanvasElement>('[data-testid="project-surface-cells"]')
      context.calls.length = 0

      await wrapper.setProps({ zoom: 0.1, scroll: { x: 10, y: 20 } })
      vi.advanceTimersByTime(10)
      expect(cells.element.style.transform).toBe('translate(-10px, -20px) scale(0.5)')
      // Only the overlay was drawn.
      expect(context.named('clearRect')).toHaveLength(1)

      vi.advanceTimersByTime(200)
      expect(cells.element.style.transform).toBe('')
      expect(context.named('clearRect')).toHaveLength(2)
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('draws a small piece live on every zoom step, as before', async () => {
    const { wrapper } = await mountSurface(projectOf(20, 10), 0.2)
    await wrapper.setProps({ zoom: 0.1 })
    expect(wrapper.find<HTMLCanvasElement>('[data-testid="project-surface-cells"]').element.style.transform).toBe('')
  })

  it('keeps redrawing on zoom and scroll after a Frame press while a draw is waiting', async () => {
    const frames = new Map<number, () => void>()
    let next = 1
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.set(next, callback) && next++)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    const flush = () => {
      const waiting = [...frames.values()]
      frames.clear()
      waiting.forEach((frame) => frame())
    }
    const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { settingFrame: true })
    flush()
    await wrapper.setProps({ zoom: 2 })
    await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { clientX: 50, clientY: 50, button: 0, buttons: 1 })
    flush()
    context.calls.length = 0

    await wrapper.setProps({ zoom: 3, scroll: { x: 30, y: 30 } })
    flush()

    expect(draws()).toBe(1)
    wrapper.unmount()
  })

  it('redraws both layers when the theme changes, at the same size', async () => {
    const { wrapper } = await mountSurface(projectOf(20, 10), 1)
    const canvas = wrapper.find<HTMLCanvasElement>('[data-testid="project-surface-cells"]').element
    const size = [canvas.width, canvas.height]
    context.calls.length = 0

    document.documentElement.dataset.theme = 'dark'
    try {
      await nextTick()
      await nextTick()
      await nextTick()

      expect(draws()).toBe(1)
      // The empty positions outside the Frame are dots in the dark theme's own color.
      expect(context.named('fill').some((call) => call.fillStyle === DARK_THEME.positionMark)).toBe(true)
      expect([canvas.width, canvas.height]).toEqual(size)
    } finally {
      document.documentElement.dataset.theme = 'light'
      await nextTick()
    }
  })

  it('fills the drawing area: a bitmap exactly as big as it is, however big the canvas', async () => {
    const small = await mountSurface(projectOf(2, 2), 1)
    const large = await mountSurface(projectOf(400, 400), 3)

    for (const { wrapper } of [small, large]) {
      const canvas = wrapper.find<HTMLCanvasElement>('[data-testid="project-surface-cells"]').element
      expect([canvas.width, canvas.height]).toEqual([1000, 800])
    }
  })

  it('draws no more for a bigger canvas: the cost follows what is in view', async () => {
    const drawn = async (columns: number, rows: number) => {
      context.calls.length = 0
      await mountSurface(projectOf(columns, rows), 1, { x: 4000, y: 4000 })
      return context.calls.length
    }

    const large = await drawn(400, 400)
    const larger = await drawn(900, 900)

    // Both look at positions well inside the Frame: the size of the Frame is nothing to the drawing.
    expect(larger).toBe(large)
  })

  it('makes a bitmap as dense as the screen: twice the pixels on a 2× display', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    try {
      viewport = { width: 400, height: 200 }
      const { wrapper } = await mountSurface(projectOf(20, 10), 1)

      const canvas = wrapper.find<HTMLCanvasElement>('[data-testid="project-surface-cells"]').element
      expect([canvas.width, canvas.height]).toEqual([800, 400])
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
    }
  })

  it('fills the empty positions outside the Frame with marks as patterns, not as a shape each', async () => {
    viewport = { width: 100, height: 100 }
    const framed = projectOf(2, 2)
    const open = { ...framed, frame: undefined }
    const marks = () => context.named('fillRect').filter((call) => typeof call.fillStyle === 'object')

    await mountSurface(open, 1, { x: 0, y: 0 })
    const unframed = marks().length
    context.calls.length = 0
    await mountSurface(framed, 1, { x: 0, y: 0 })

    expect(unframed).toBe(1)
    expect(marks().length).toBeLessThanOrEqual(4)
    expect(context.named('arc')).toHaveLength(0)
  })

  it('draws a bead painted far from the first bead when the view is moved to it', async () => {
    viewport = { width: 100, height: 100 }
    const project = { ...projectOf(2, 2), beads: { [-500]: { [3000]: '#e63746' } } }
    const home = await mountSurface(project, 1, { x: 0, y: 0 })
    const atHome = context.named('drawImage').length + context.named('fillRect').length
    home.wrapper.unmount()
    context.calls.length = 0

    await mountSurface(project, 1, { x: 3000 * 20 - 40, y: -500 * 20 - 40 })

    expect(atHome).toBeGreaterThanOrEqual(0)
    expect(context.named('drawImage').length + context.named('fillRect').length).toBeGreaterThan(0)
    expect(context.calls.some((call) => call.fillStyle === '#e63746' || call.name === 'drawImage')).toBe(true)
  })

  describe('when the Project is edited', () => {
    /** The Project with one bead of one row painted. */
    function painted(project: Project, row: number, column: number): Project {
      return withFrameGrid(
        project,
        frameGrid(project).map((cells, index) => (index === row ? cells.map((cell, at) => (at === column ? { color: '#e63746' } : cell)) : cells)),
      )
    }

    it('draws only the rows it changed, and their neighbours', async () => {
      viewport = { width: 400, height: 600 }
      const project = projectOf(20, 30)
      const { wrapper } = await mountSurface(project)
      context.calls.length = 0

      await wrapper.setProps({ project: painted(project, 12, 4) })

      // Row 12 is y 240 to 260, across the whole 400px width of the view: one band, cut to it.
      expect(context.named('rect').map((call) => call.args)).toEqual([[0, 240, 400, 20]])
    })

    it('draws a band for each cluster of changed rows, as a Mirror stroke changes rows far apart', async () => {
      viewport = { width: 400, height: 600 }
      const project = projectOf(20, 30)
      const { wrapper } = await mountSurface(project)
      context.calls.length = 0

      await wrapper.setProps({ project: painted(painted(project, 3, 4), 26, 4) })

      expect(context.named('rect').map((call) => call.args[1])).toEqual([60, 520])
    })

    it('draws no beads at all when nothing in view changed, and only redraws the overlay', async () => {
      viewport = { width: 400, height: 600 }
      const project = projectOf(20, 30)
      const { wrapper } = await mountSurface(project)
      context.calls.length = 0

      await wrapper.setProps({ project: { ...project, updatedAt: project.updatedAt + 1 } })

      expect(context.named('rect')).toHaveLength(0)
    })

    it('draws everything again when so much changed that bands would cost more, such as an Undo', async () => {
      viewport = { width: 400, height: 1000 }
      const project = projectOf(20, 60)
      const { wrapper } = await mountSurface(project)
      const everyOtherRow = (target: Project) => {
        let result = target
        for (let row = 0; row < 60; row += 1) result = painted(result, row, 0)
        return result
      }
      context.calls.length = 0

      await wrapper.setProps({ project: everyOtherRow(project) })

      expect(context.named('rect')).toHaveLength(0)
      expect(draws()).toBe(1)
    })

    it('draws everything again when the Frame changes, since empty beads are drawn inside it', async () => {
      viewport = { width: 400, height: 600 }
      const project = projectOf(20, 30)
      const { wrapper } = await mountSurface(project)
      context.calls.length = 0

      await wrapper.setProps({ project: { ...project, frame: { ...project.frame!, rows: 10 } } })

      expect(context.named('rect')).toHaveLength(0)
      expect(draws()).toBe(1)
    })

    it('draws everything again when Row progress moves, since rows are faded by it', async () => {
      viewport = { width: 400, height: 600 }
      const project = projectOf(20, 30)
      const { wrapper } = await mountSurface(project)
      context.calls.length = 0

      await wrapper.setProps({ project: { ...project, rowProgress: { direction: 'rows', currentRow: 5, currentColumn: 0 } } })

      expect(context.named('rect')).toHaveLength(0)
    })

    it('draws everything again when the view moves', async () => {
      const project = projectOf(20, 30)
      const { wrapper } = await mountSurface(project)
      context.calls.length = 0

      await wrapper.setProps({ scroll: { x: 40, y: 0 } })

      expect(context.named('rect')).toHaveLength(0)
      expect(draws()).toBe(1)
    })
  })

  it('shows the turn of a rotated Project in what it says about itself', async () => {
    const { wrapper } = await mountSurface(projectOf(20, 10, { rotation: 90 }), 1, { x: -300, y: 0 })

    const root = wrapper.find('[data-testid="project-surface"]')
    expect(root.attributes('data-rotation')).toBe('90')
    expect(root.attributes('data-scroll-x')).toBe('-300')
  })

  it('draws the Row progress marker on the overlay, and no marker when no bead is in the pass', async () => {
    const progress: RowProgress = { direction: 'rows', currentRow: 2, currentColumn: 0 }
    // Only a cell that holds a bead is marked (ticket 411).
    const beads = { 2: { 0: '#e63746', 1: '#e63746' } }

    await mountSurface(projectOf(20, 10, { beads, rowProgress: { ...progress, currentRow: 0 } }))
    const without = context.named('stroke').length

    context.calls.length = 0
    await mountSurface(projectOf(20, 10, { beads, rowProgress: progress }))
    // The marker is one stroke: the rings round the beads in the pass (tickets 375, 376), over whatever else the overlay strokes.
    expect(context.named('stroke')).toHaveLength(without + 1)
  })

  describe('moving the canvas', () => {
    it('scrolls by the wheel, sideways with Shift on a vertical wheel', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      const surface = wrapper.find('[data-testid="project-surface"]')

      surface.element.dispatchEvent(new WheelEvent('wheel', { deltaX: 3, deltaY: 40, bubbles: true, cancelable: true }))
      surface.element.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: 40, shiftKey: true, bubbles: true, cancelable: true }))

      expect(wrapper.emitted('scroll')).toEqual([[3, 40], [40, 0]])
    })

    it('says the canvas is being moved while the wheel scrolls it, and that it stopped once the wheel is quiet (ticket 415)', async () => {
      vi.useFakeTimers()
      try {
        const { wrapper } = await mountSurface(projectOf(20, 10))
        const surface = wrapper.find('[data-testid="project-surface"]')

        surface.element.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }))
        surface.element.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }))
        expect(wrapper.emitted('pressing')).toEqual([[true]])

        vi.advanceTimersByTime(200)
        expect(wrapper.emitted('pressing')).toEqual([[true], [false]])
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps the browser from scrolling the page behind it', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      const event = new WheelEvent('wheel', { deltaY: 40, cancelable: true, bubbles: true })

      wrapper.find('[data-testid="project-surface"]').element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    it('zooms about the pointer on Ctrl + wheel or ⌘ + wheel, in for a wheel up', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      const surface = wrapper.find('[data-testid="project-surface"]')

      surface.element.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, ctrlKey: true, clientX: 120, clientY: 60, bubbles: true, cancelable: true }))
      surface.element.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, metaKey: true, clientX: 120, clientY: 60, bubbles: true, cancelable: true }))

      const calls = wrapper.emitted('zoom-by') as [number, { x: number; y: number }][]
      expect(calls[0]![0]).toBeGreaterThan(1)
      expect(calls[1]![0]).toBeLessThan(1)
      expect(calls[0]![1]).toEqual({ x: 120, y: 60 })
      expect(wrapper.emitted('scroll')).toBeUndefined()
    })

    it('drags the canvas, and draws nothing, while moving (the Hand tool or Space)', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { moving: true })
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointerdown', { clientX: 50, clientY: 50, button: 0, buttons: 1 })
      await surface.trigger('pointermove', { clientX: 70, clientY: 45, buttons: 1 })
      await surface.trigger('pointerup', { clientX: 70, clientY: 45 })
      await surface.trigger('pointermove', { clientX: 90, clientY: 45, buttons: 0 })

      expect(wrapper.emitted('pan')).toEqual([[20, -5]])
      expect(wrapper.emitted('cell-primary-down')).toBeUndefined()
      expect(wrapper.emitted('cell-hover')).toBeUndefined()
    })

    it('drags the canvas with the middle button on any tool', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointerdown', { clientX: 50, clientY: 50, button: 1, buttons: 4 })
      await surface.trigger('pointermove', { clientX: 40, clientY: 60, buttons: 4 })

      expect(wrapper.emitted('pan')).toEqual([[-10, 10]])
      expect(wrapper.emitted('cell-primary-down')).toBeUndefined()
    })

    it('shows an open hand while moving, closed while dragging', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { moving: true })
      const surface = wrapper.find('[data-testid="project-surface"]')
      expect(surface.classes()).toContain('project-surface--moving')

      await surface.trigger('pointerdown', { clientX: 5, clientY: 5, button: 0, buttons: 1 })
      expect(surface.classes()).toContain('project-surface--dragging')

      await surface.trigger('pointerup')
      expect(surface.classes()).not.toContain('project-surface--dragging')
    })
  })

  describe('picking a color (ticket 403)', () => {
    const painted = (): Project => projectOf(20, 10, { beads: { 3: { 4: '#123456' } } })
    const at = (project: Project, row: number, column: number) =>
      surfaceView({ space: OPEN_SPACE, technique: project.technique, rotation: project.rotation, zoom: 1, scroll: { x: 0, y: 0 } }).beadToPoint({ row, column })

    it('shows the eyedropper pointer, and the color under it in a chip over a painted bead only', async () => {
      const project = painted()
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { picking: true })
      const surface = wrapper.find('[data-testid="project-surface"]')
      expect(surface.attributes('style')).toContain('cursor: url(')
      expect(surface.classes()).toContain('project-surface--picking')

      const bead = at(project, 3, 4)
      await surface.trigger('pointermove', { clientX: bead.x, clientY: bead.y, pointerType: 'mouse', buttons: 0 })
      expect(wrapper.find('[data-testid="pick-chip"]').text()).toBe('#123456')

      const empty = at(project, 6, 6)
      await surface.trigger('pointermove', { clientX: empty.x, clientY: empty.y, pointerType: 'mouse', buttons: 0 })
      expect(wrapper.find('[data-testid="pick-chip"]').exists()).toBe(false)
    })

    it('has no eyedropper and no chip when not picking', async () => {
      const project = painted()
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')
      const bead = at(project, 3, 4)
      await surface.trigger('pointermove', { clientX: bead.x, clientY: bead.y, pointerType: 'mouse', buttons: 0 })
      expect(surface.attributes('style') ?? '').not.toContain('cursor')
      expect(wrapper.find('[data-testid="pick-chip"]').exists()).toBe(false)
    })
  })

  describe('the pointer', () => {
    /** Where on the screen a bead's centre is, for a surface at the screen's corner, at a zoom and a scroll. */
    function centreOf(project: Project, row: number, column: number, zoom = 1, scroll = { x: 0, y: 0 }): { clientX: number; clientY: number } {
      const at = surfaceView({ space: OPEN_SPACE, technique: project.technique, rotation: project.rotation, zoom, scroll }).beadToPoint({ row, column })
      return { clientX: at.x, clientY: at.y }
    }

    describe('finished rows (ticket 352)', () => {
      /** A red bead in the Frame's first row, and the weaver on the third. */
      function weaving(): Project {
        const project = projectOf(20, 10)
        const painted = withFrameGrid(project, frameGrid(project).map((cells, index) => (index === 0 ? cells.map((cell, at) => (at === 0 ? { color: '#e63746' } : cell)) : cells)))
        return { ...painted, rowProgress: { direction: 'rows', currentRow: 2, currentColumn: 0 } }
      }
      const redShown = () => context.named('fillRect').some((call) => call.fillStyle === '#e63746')
      const finishedCentre = (project: Project) => centreOf(project, project.frame!.row, project.frame!.column)

      it('dims them by default, keeping the bead\'s own color', async () => {
        await mountSurface(weaving())

        expect(redShown()).toBe(false)
        expect(context.named('fillRect').some((call) => call.fillStyle === fadeOver('#e63746', DEFAULT_THEME.canvas, 0.5))).toBe(true)
      })

      it('draws them at normal color, and the current row unbrightened, while Row highlight is off, and dims again when it is on (ticket 474)', async () => {
        const { wrapper } = await mountSurface(weaving(), 1, { x: 0, y: 0 }, { rowMarks: false })
        expect(redShown()).toBe(true)

        context.calls.length = 0
        await wrapper.setProps({ rowMarks: true })
        await nextTick()
        await nextTick()
        expect(redShown()).toBe(false)
      })

      it('ignores a press on a finished row while Row highlight is off, so turning it on again finds them dimmed (ticket 474)', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { rowMarks: false })
        await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...finishedCentre(project), pointerType: 'mouse', button: 0, buttons: 1 })

        await wrapper.setProps({ rowMarks: true })
        await nextTick()
        await nextTick()
        context.calls.length = 0
        await wrapper.setProps({ project: { ...project } })
        expect(redShown()).toBe(false)
      })

      it('draws them at normal color while a mouse or a pen hovers a finished row, and dims them again when it leaves', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')

        context.calls.length = 0
        await surface.trigger('pointermove', { ...finishedCentre(project), pointerType: 'mouse', buttons: 0 })
        await nextTick()
        expect(redShown()).toBe(true)

        context.calls.length = 0
        await surface.trigger('pointerleave', { pointerType: 'mouse' })
        await nextTick()
        expect(redShown()).toBe(false)
      })

      /** Far enough along the finished row to be past the Frame's last column: Canvas, not a bead of the Frame. */
      const PAST_THE_FRAME = 40
      const moveTo = (surface: ReturnType<VueWrapper['find']>, at: { clientX: number; clientY: number }) =>
        surface.trigger('pointermove', { ...at, pointerType: 'mouse', buttons: 0 })

      it('keeps them dimmed while the pointer is on empty canvas or on a row still to weave, and dims them again when it moves off a finished row', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')
        const todo = centreOf(project, project.frame!.row + 5, project.frame!.column)

        context.calls.length = 0
        await moveTo(surface, centreOf(project, project.frame!.row, project.frame!.column + PAST_THE_FRAME))
        await nextTick()
        expect(redShown()).toBe(false)

        await moveTo(surface, todo)
        await nextTick()
        expect(redShown()).toBe(false)

        await moveTo(surface, finishedCentre(project))
        await nextTick()
        expect(redShown()).toBe(true)

        context.calls.length = 0
        await moveTo(surface, todo)
        await nextTick()
        expect(redShown()).toBe(false)
      })

      it('follows a finished column when the Row progress runs down the columns', async () => {
        const project = { ...weaving(), rowProgress: { direction: 'columns' as const, currentRow: 0, currentColumn: 2 } }
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')

        context.calls.length = 0
        await moveTo(surface, centreOf(project, project.frame!.row + 5, project.frame!.column + 5))
        await nextTick()
        expect(redShown()).toBe(false)

        await moveTo(surface, finishedCentre(project))
        await nextTick()
        expect(redShown()).toBe(true)
      })

      it('asks again what is under a pointer that has not moved when the weaver\'s row changes or the canvas scrolls', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')
        const onFirstRow = finishedCentre(project)

        await moveTo(surface, onFirstRow)
        await nextTick()
        expect(redShown()).toBe(true)

        // Undo to before the first row was finished: the same spot is now a row still to weave.
        context.calls.length = 0
        await wrapper.setProps({ project: { ...project, rowProgress: { ...project.rowProgress, currentRow: 0 } } })
        await nextTick()
        await nextTick()
        expect(redShown()).toBe(false)

        // Finished again.
        context.calls.length = 0
        await wrapper.setProps({ project })
        await nextTick()
        await nextTick()
        expect(redShown()).toBe(true)

        // Scrolled so the pointer is over empty canvas, not the finished row.
        context.calls.length = 0
        await wrapper.setProps({ scroll: { x: 0, y: 2000 } })
        await nextTick()
        await nextTick()
        expect(redShown()).toBe(false)
      })

      it('leaves them as they are while the canvas is being dragged', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')

        await moveTo(surface, finishedCentre(project))
        await nextTick()
        expect(redShown()).toBe(true)

        context.calls.length = 0
        await surface.trigger('pointerdown', { clientX: 900, clientY: 700, pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 1, buttons: 4 })
        await moveTo(surface, centreOf(project, project.frame!.row + 5, project.frame!.column))
        await nextTick()
        expect(context.named('fillRect').some((call) => call.fillStyle === fadeOver('#e63746', DEFAULT_THEME.canvas, 0.5))).toBe(false)
      })

      it('does not count a finger\'s touch as a hover', async () => {
        const { wrapper } = await mountSurface(weaving())
        const surface = wrapper.find('[data-testid="project-surface"]')

        context.calls.length = 0
        await surface.trigger('pointermove', { clientX: 900, clientY: 700, pointerType: 'touch', buttons: 0 })
        await nextTick()

        expect(redShown()).toBe(false)
      })

      it('toggles them between dimmed and normal with a press on a finished row, which stays until the next one', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')

        context.calls.length = 0
        await surface.trigger('pointerdown', { ...finishedCentre(project), pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0, buttons: 1 })
        await nextTick()
        expect(redShown()).toBe(true)

        // The finger lifts and the toggle holds, hover or not.
        context.calls.length = 0
        await surface.trigger('pointerup', { pointerType: 'touch' })
        await surface.trigger('pointerleave', { pointerType: 'touch' })
        await nextTick()
        expect(wrapper.emitted('cell-primary-down')).toHaveLength(1)

        context.calls.length = 0
        await surface.trigger('pointerdown', { ...finishedCentre(project), pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0, buttons: 1 })
        await nextTick()
        expect(redShown()).toBe(false)
      })

      it('leaves them alone for a press on a row still to weave', async () => {
        const project = weaving()
        const { wrapper } = await mountSurface(project)
        const surface = wrapper.find('[data-testid="project-surface"]')

        context.calls.length = 0
        await surface.trigger('pointerdown', { ...centreOf(project, project.frame!.row + 5, project.frame!.column), pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0, buttons: 1 })
        await nextTick()

        expect(redShown()).toBe(false)
      })
    })

    it('moves the canvas with a finger or mouse, and draws with the pen, in Pen mode (ticket 325)', async () => {
      const project = projectOf(20, 10, { frame: undefined })
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { inputMode: 'pen' })
      const surface = wrapper.find('[data-testid="project-surface"]')

      for (const pointerType of ['touch', 'mouse']) {
        await surface.trigger('pointerdown', { clientX: 50, clientY: 50, pointerType, pointerId: 1, button: 0, buttons: 1 })
        await surface.trigger('pointermove', { clientX: 60, clientY: 50, pointerType, pointerId: 1, buttons: 1 })
        await surface.trigger('pointerup', { pointerType, pointerId: 1 })
      }
      expect(wrapper.emitted('pan')).toEqual([[10, 0], [10, 0]])
      expect(wrapper.emitted('cell-primary-down')).toBeUndefined()

      await surface.trigger('pointerdown', { ...centreOf(project, 0, 0), pointerType: 'pen', pointerId: 2, button: 0, buttons: 1 })
      expect(wrapper.emitted('cell-primary-down')).toEqual([[0, 0]])
      expect(wrapper.emitted('pan')).toHaveLength(2)
    })

    it('moves the canvas with the pen, and draws with a finger or mouse, in Mouse mode (ticket 325)', async () => {
      const project = projectOf(20, 10, { frame: undefined })
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { inputMode: 'mouse' })
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointerdown', { clientX: 50, clientY: 50, pointerType: 'pen', pointerId: 1, button: 0, buttons: 1 })
      await surface.trigger('pointermove', { clientX: 50, clientY: 62, pointerType: 'pen', pointerId: 1, buttons: 1 })
      await surface.trigger('pointerup', { pointerType: 'pen', pointerId: 1 })
      expect(wrapper.emitted('pan')).toEqual([[0, 12]])
      expect(wrapper.emitted('cell-primary-down')).toBeUndefined()

      for (const pointerType of ['touch', 'mouse']) {
        await surface.trigger('pointerdown', { ...centreOf(project, 0, 0), pointerType, pointerId: 2, button: 0, buttons: 1 })
        await surface.trigger('pointerup', { pointerType, pointerId: 2 })
      }
      expect(wrapper.emitted('cell-primary-down')).toEqual([[0, 0], [0, 0]])
    })

    it('does not hover beads for the pointer that moves the canvas (ticket 325)', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { inputMode: 'pen' })
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 0, 1), pointerType: 'mouse', buttons: 0 })
      expect(wrapper.emitted('cell-hover')).toBeUndefined()
      await surface.trigger('pointermove', { ...centreOf(project, 0, 2), pointerType: 'pen', buttons: 0 })
      expect(wrapper.emitted('cell-hover')).toEqual([[0, 2]])
    })

    it('draws with every pointer when no input mode is given', async () => {
      const project = projectOf(20, 10, { frame: undefined })
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      for (const pointerType of ['pen', 'touch', 'mouse']) {
        await surface.trigger('pointerdown', { ...centreOf(project, 0, 0), pointerType, pointerId: 1, button: 0, buttons: 1 })
        await surface.trigger('pointerup', { pointerType, pointerId: 1 })
      }
      expect(wrapper.emitted('cell-primary-down')).toHaveLength(3)
      expect(wrapper.emitted('pan')).toBeUndefined()
    })

    const events = (wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper']) =>
      wrapper.emitted() as Record<string, unknown[][]>

    describe('against the Frame (ADR 0066)', () => {
      const framed = () => projectOf(4, 4, { frame: { row: 10, column: 10, rows: 4, columns: 4, beads: {} } })

      it('gives a press on a bead right against the Frame to the tool, with no not-allowed cursor', async () => {
        const project = framed()
        const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 })
        const surface = wrapper.find('[data-testid="project-surface"]')

        await surface.trigger('pointermove', centreOf(project, 9, 10))
        await surface.trigger('pointerdown', { ...centreOf(project, 9, 10), button: 0, buttons: 1 })

        expect(surface.attributes('class')).not.toContain('refused')
        expect(wrapper.emitted('cell-primary-down')).toEqual([[9, 10]])
      })
    })

    it('says which bead a press landed on, hovering it first as its own pointerenter did', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)

      await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...centreOf(project, 3, 5), button: 0, buttons: 1 })

      expect(events(wrapper)['cell-hover']).toEqual([[3, 5]])
      expect(events(wrapper)['cell-primary-down']).toEqual([[3, 5]])
    })

    it('does not hover again for a press on the bead the pointer was already over', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 3, 5), buttons: 0 })
      await surface.trigger('pointerdown', { ...centreOf(project, 3, 5), button: 0, buttons: 1 })

      expect(events(wrapper)['cell-hover']).toEqual([[3, 5]])
    })

    it('says a right press is a secondary one', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)

      await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...centreOf(project, 1, 2), button: 2, buttons: 2 })

      expect(events(wrapper)['cell-secondary-down']).toEqual([[1, 2]])
      expect(events(wrapper)['cell-primary-down']).toBeUndefined()
    })

    it('ignores a press with any other button', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)

      await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...centreOf(project, 1, 2), button: 1, buttons: 4 })

      expect(events(wrapper)['cell-primary-down']).toBeUndefined()
      expect(events(wrapper)['cell-secondary-down']).toBeUndefined()
    })

    it('hovers each bead it moves onto, once, and continues a stroke with the button held', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 0, 0), buttons: 0 })
      await surface.trigger('pointermove', { clientX: centreOf(project, 0, 0).clientX + 3, clientY: centreOf(project, 0, 0).clientY, buttons: 0 })
      await surface.trigger('pointermove', { ...centreOf(project, 0, 1), buttons: 1 })
      await surface.trigger('pointermove', { ...centreOf(project, 0, 2), buttons: 2 })

      expect(events(wrapper)['cell-hover']).toEqual([[0, 0], [0, 1], [0, 2]])
      expect(events(wrapper)['cell-primary-move']).toEqual([[0, 1]])
      expect(events(wrapper)['cell-secondary-move']).toEqual([[0, 2]])
    })

    it('drags a touch or pen stroke across beads the same way a held mouse button does (ticket 60)', async () => {
      const project = projectOf(20, 10, { frame: undefined })
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      for (const pointerType of ['touch', 'pen']) {
        await surface.trigger('pointerdown', { ...centreOf(project, 0, 0), pointerType, pointerId: 1, button: 0, buttons: 1 })
        await surface.trigger('pointermove', { ...centreOf(project, 0, 1), pointerType, pointerId: 1, buttons: 1 })
        await surface.trigger('pointermove', { ...centreOf(project, 0, 2), pointerType, pointerId: 1, buttons: 1 })
        await surface.trigger('pointerleave')
      }

      expect(events(wrapper)['cell-primary-down']).toEqual([[0, 0], [0, 0]])
      expect(events(wrapper)['cell-primary-move']).toEqual([[0, 1], [0, 2], [0, 1], [0, 2]])
    })

    it('never hovers for a finger touch (ticket 166: no hover paint preview on a coarse pointer), but still hovers for a Pencil', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointerdown', { ...centreOf(project, 0, 0), pointerType: 'touch', pointerId: 1, button: 0, buttons: 1 })
      await surface.trigger('pointermove', { ...centreOf(project, 0, 1), pointerType: 'touch', pointerId: 1, buttons: 1 })
      expect(events(wrapper)['cell-hover']).toBeUndefined()

      await surface.trigger('pointerdown', { ...centreOf(project, 1, 0), pointerType: 'pen', pointerId: 2, button: 0, buttons: 1 })
      expect(events(wrapper)['cell-hover']).toEqual([[1, 0]])
    })

    it('finds a bead anywhere on the Canvas: far from the first bead, and at negative positions', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project, 1, { x: -2000, y: -2000 })
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointerdown', { ...centreOf(project, -40, -25, 1, { x: -2000, y: -2000 }), button: 0, buttons: 1 })
      await surface.trigger('pointermove', { ...centreOf(project, 400, 9000, 1, { x: -2000, y: -2000 }), buttons: 1 })

      expect(events(wrapper)['cell-primary-down']).toEqual([[-40, -25]])
      expect(events(wrapper)['cell-primary-move']).toEqual([[400, 9000]])
    })

    it('says the hover is over when the pointer leaves', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 0, 0), buttons: 0 })
      await surface.trigger('pointerleave')
      await surface.trigger('pointermove', { ...centreOf(project, 0, 0), buttons: 0 })

      expect(events(wrapper)['hover-end']).toHaveLength(1)
      // Back over the same bead after leaving: a fresh hover.
      expect(events(wrapper)['cell-hover']).toEqual([[0, 0], [0, 0]])
    })

    it('works out the bead at any zoom, on peyote\'s and brick stitch\'s shifted rows', async () => {
      for (const technique of ['peyote', 'brick'] as const) {
        const project = projectOf(20, 10, {}, technique)
        const { wrapper } = await mountSurface(project, 2)

        await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...centreOf(project, 5, 7, 2), button: 0, buttons: 1 })

        expect(events(wrapper)['cell-primary-down']).toEqual([[5, 7]])
      }
    })

    it('works out the bead of a rotated Project', async () => {
      const project = projectOf(20, 10, { rotation: 90 })
      const { wrapper } = await mountSurface(project)

      await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...centreOf(project, 2, 15), button: 0, buttons: 1 })

      expect(events(wrapper)['cell-primary-down']).toEqual([[2, 15]])
    })

    it('does not open the browser\'s menu on a right press', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      const event = new Event('contextmenu', { cancelable: true, bubbles: true })

      wrapper.find('[data-testid="project-surface"]').element.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    it('hides the OS pointer over a bead, and shows the ordinary cursor elsewhere', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 0, 0), buttons: 0 })
      expect(surface.classes()).toContain('project-surface--over-bead')

      await surface.trigger('pointerleave')
      expect(surface.classes()).not.toContain('project-surface--over-bead')
    })
  })

  describe('the bead-shaped pointer (ticket 353)', () => {
    /** The marker's fill: the only translucent fillRect of 90% of a 20px bead less 1px at zoom 1. */
    const marker = () => context.named('fillRect').filter((call) => call.globalAlpha === 0.6 && call.args[2] === 17)

    it('follows a mouse and a hovering pen, centred on the pointer, in the chosen color', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { previewColor: '#e63746' })
      const surface = wrapper.find('[data-testid="project-surface"]')

      for (const pointerType of ['mouse', 'pen']) {
        context.calls.length = 0
        await surface.trigger('pointermove', { clientX: 105, clientY: 47, pointerType, buttons: 0 })
        await vi.waitFor(() => expect(marker().map((call) => [call.fillStyle, call.args[0], call.args[1]])).toEqual([['#e63746', 96.5, 38.5]]))
      }
    })

    it('is gone when the pen lifts away, and a finger shows none', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { previewColor: '#e63746' })
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { clientX: 105, clientY: 47, pointerType: 'pen', buttons: 0 })
      await vi.waitFor(() => expect(marker()).toHaveLength(1))
      context.calls.length = 0
      await surface.trigger('pointerleave', { pointerType: 'pen' })
      await vi.waitFor(() => expect(context.named('clearRect')).toHaveLength(1))
      expect(marker()).toHaveLength(0)

      context.calls.length = 0
      await surface.trigger('pointermove', { clientX: 105, clientY: 47, pointerType: 'touch', buttons: 1 })
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(marker()).toHaveLength(0)
    })
  })

  describe('the bead-shaped pointer, in the cases that hold it back (ticket 353)', () => {
    const marker = () => context.named('fillRect').filter((call) => call.globalAlpha === 0.6 && call.args[2] === 17)
    const hover = { clientX: 105, clientY: 47, buttons: 0 }
    const surfaceOf = (wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper']) => wrapper.find('[data-testid="project-surface"]')

    it('goes while Space is held, and comes back when it is let go', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { previewColor: '#e63746' })
      await surfaceOf(wrapper).trigger('pointermove', { ...hover, pointerType: 'mouse' })
      await vi.waitFor(() => expect(marker()).toHaveLength(1))

      context.calls.length = 0
      await wrapper.setProps({ markerHidden: true })
      await vi.waitFor(() => expect(context.named('clearRect')).toHaveLength(1))
      expect(marker()).toHaveLength(0)

      context.calls.length = 0
      await wrapper.setProps({ markerHidden: false })
      await vi.waitFor(() => expect(marker()).toHaveLength(1))
    })

    it('belongs to the pointer that draws in the input mode: the mouse in Mouse mode, the pen in Pen mode', async () => {
      for (const [inputMode, draws, moves] of [['mouse', 'mouse', 'pen'], ['pen', 'pen', 'mouse']] as const) {
        const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { previewColor: '#e63746', inputMode })
        const surface = surfaceOf(wrapper)

        context.calls.length = 0
        await surface.trigger('pointermove', { ...hover, pointerType: draws })
        await vi.waitFor(() => expect(marker()).toHaveLength(1))

        await surface.trigger('pointerleave', { pointerType: draws })
        context.calls.length = 0
        await surface.trigger('pointermove', { ...hover, pointerType: moves })
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(marker()).toHaveLength(0)
      }
    })

    it('goes when the pen is cancelled', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { previewColor: '#e63746' })
      const surface = surfaceOf(wrapper)
      await surface.trigger('pointermove', { ...hover, pointerType: 'pen' })
      await vi.waitFor(() => expect(marker()).toHaveLength(1))

      context.calls.length = 0
      await surface.trigger('pointercancel', { pointerType: 'pen' })
      await vi.waitFor(() => expect(context.named('clearRect')).toHaveLength(1))
      expect(marker()).toHaveLength(0)
    })
  })

  describe('the hover preview', () => {
    it('is drawn on the overlay: the paint color faintly on each bead named', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [{ row: 1, column: 2 }, { row: 1, column: 17 }], previewColor: '#e63746' })

      const faint = context.named('fillRect').filter((call) => call.globalAlpha === 0.6)
      expect(faint.map((call) => call.args)).toEqual([[40.5, 20.5, 19, 19], [340.5, 20.5, 19, 19]])
      // The cells were not drawn again for it.
      expect(context.named('rect')).toHaveLength(0)
    })

    it('is gone from the overlay when the cells are cleared', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10), 1)
      await wrapper.setProps({ previewCells: [{ row: 1, column: 2 }], previewColor: '#e63746' })
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [] })

      expect(context.named('fillRect')).toHaveLength(0)
      expect(context.named('clearRect')).toHaveLength(1)
    })

    it('follows the zoom of the view', async () => {
      const { wrapper } = await mountSurface(projectOf(250, 250), 3)
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [{ row: 0, column: 0 }], previewColor: null })

      // A neutral outline: filled even-odd in the dark ink, through the transform that scales it by 3 (the rulers
      // then reset it to the viewport's own px, so the transform the outline was drawn through is the one before).
      expect(context.named('fill').some((call) => call.args[0] === 'evenodd')).toBe(true)
      expect(context.named('setTransform').some((call) => call.args[0] === 3 && call.args[3] === 3)).toBe(true)
    })
  })

  describe('the other overlays', () => {
    it('draws the Selection over the beads when one is marked out, and takes it away again', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ selection: { top: 1, left: 1, rows: 2, columns: 3 } })

      // The rectangle's border, four strips; no wash on its beads.
      expect(context.named('fillRect')).toHaveLength(4)
      expect(context.named('rect')).toHaveLength(0) // the cells were left alone

      context.calls.length = 0
      await wrapper.setProps({ selection: undefined })
      expect(context.named('fillRect')).toHaveLength(0)
    })

    it('draws Mirror\'s axis lines when a direction has an axis', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ mirrorAxisCounts: { columns: 1, rows: 0 } })

      expect(context.named('fillRect').map((call) => call.args)).toEqual([[199, 0, 2, 200]])
    })

    it('draws the beads a "Mirror current" hover would overwrite, faded', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ dimmedCells: [{ row: 0, column: 0 }, { row: 0, column: 1 }] })

      // A faded bead is a bitmap, made once for both (two rectangles on the bitmap's own canvas) and blitted for each.
      expect(context.named('drawImage')).toHaveLength(2)
      expect(context.named('rect')).toHaveLength(0)
    })
  })
})

describe('ProjectSurface with a Selection (ticket 414)', () => {
  const selection = { top: 1, left: 1, rows: 2, columns: 3 }

  it('reports a press on a handle or inside as a Selection press, and the drag and release after it, and draws no bead', async () => {
    const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { selecting: true, selection })
    const surface = wrapper.find('[data-testid="project-surface"]')

    // The box is (20, 20) to (80, 60): near its top-left corner, then inside, then well away.
    await surface.trigger('pointerdown', { button: 0, clientX: 24, clientY: 24, pointerId: 1 })
    await surface.trigger('pointermove', { buttons: 1, clientX: 45, clientY: 45, pointerId: 1 })
    await surface.trigger('pointerup', { pointerId: 1 })
    await surface.trigger('pointerdown', { button: 0, clientX: 50, clientY: 40, pointerId: 1 })
    await surface.trigger('pointerup', { pointerId: 1 })
    await surface.trigger('pointerdown', { button: 0, clientX: 250, clientY: 150, pointerId: 1 })
    await surface.trigger('pointerup', { pointerId: 1 })

    expect(wrapper.emitted('selection-press')!.map(([target]) => target)).toEqual([{ kind: 'handle', edges: ['top', 'left'] }, { kind: 'inside' }])
    expect(wrapper.emitted('selection-drag')).toEqual([[{ row: 2, column: 2 }]])
    expect(wrapper.emitted('selection-release')).toHaveLength(2)
    // Only the press away from the Selection reached the beads.
    expect(wrapper.emitted('cell-primary-down')).toEqual([[7, 12]])
  })

  it('leaves the press to the beads when the tool is not Select or Piece, or there is no Selection', async () => {
    for (const props of [{ selecting: false, selection }, { selecting: true }]) {
      const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, props)
      await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { button: 0, clientX: 50, clientY: 40, pointerId: 1 })
      expect(wrapper.emitted('selection-press')).toBeUndefined()
      expect(wrapper.emitted('cell-primary-down')).toBeDefined()
    }
  })

  it('shows the native arrow instead of the bead-shaped marker, and a resize cursor over a handle', async () => {
    const { wrapper } = await mountSurface(projectOf(20, 10), 1, { x: 0, y: 0 }, { selecting: true, selection })
    const surface = wrapper.find('[data-testid="project-surface"]')

    await surface.trigger('pointermove', { clientX: 50, clientY: 40, pointerId: 1, pointerType: 'mouse' })
    expect(surface.classes()).not.toContain('project-surface--over-bead')
    expect(surface.attributes('style') ?? '').not.toContain('resize')

    await surface.trigger('pointermove', { clientX: 22, clientY: 22, pointerId: 1, pointerType: 'mouse' })
    expect(surface.attributes('style')).toContain('nwse-resize')
  })
})

describe('ProjectSurface with a Frame', () => {
  const framed = () => projectOf(8, 6, { frame: { row: 0, column: 0, columns: 8, rows: 6, beads: {} } })

  /** A press at a point of the viewport, then moves and a release. */
  async function gesture(wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper'], from: [number, number], to: [number, number]) {
    const surface = wrapper.find('[data-testid="project-surface"]')
    await surface.trigger('pointerdown', { button: 0, clientX: from[0], clientY: from[1], pointerId: 1 })
    await surface.trigger('pointermove', { buttons: 1, clientX: to[0], clientY: to[1], pointerId: 1 })
    await surface.trigger('pointerup', { clientX: to[0], clientY: to[1], pointerId: 1 })
  }

  /** A press on the Move handle's button, handed to the surface the way FrameChrome does (ticket 473). */
  function pressMoveHandle(wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper'], at: [number, number], pointerType = 'mouse'): void {
    const event = { button: 0, clientX: at[0], clientY: at[1], pointerId: 1, pointerType, isPrimary: true, preventDefault: () => {} }
    ;(wrapper.vm as unknown as { pressMoveHandle(event: PointerEvent): void }).pressMoveHandle(event as unknown as PointerEvent)
  }

  it('reports the Frame\'s place always, with edit on or off', async () => {
    const { wrapper } = await mountSurface(framed(), 1)
    expect(wrapper.emitted('frame-anchor')!.at(-1)![0]).toMatchObject({ box: { left: expect.any(Number) } })
  })

  it('reports no Frame place once the Frame is scrolled wholly out of view, so no control stays on screen', async () => {
    const { wrapper } = await mountSurface(framed(), 1, { x: 5000, y: 5000 }, { settingFrame: true })
    expect(wrapper.emitted('frame-anchor')!.at(-1)![0]).toBeUndefined()
  })

  it('reports a press on a resize handle, the drag and the release, and draws no bead', async () => {
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: true })
    // The bottom-right handle stands in the gutter, 7.5px out from the corner of the Frame's line, which is 7px outside its beads (8 × 6 beads of 20px).
    await gesture(wrapper, [175, 135], [185, 145])

    expect(wrapper.emitted('frame-press')!.map(([target]) => target)).toEqual([{ kind: 'handle', edges: ['bottom', 'right'] }])
    expect(wrapper.emitted('frame-drag')).toHaveLength(1)
    expect(wrapper.emitted('frame-release')).toHaveLength(1)
    expect(wrapper.emitted('cell-primary-down')).toBeUndefined()
  })

  it('leaves a press inside the Frame, or away from it, to the tool', async () => {
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: true })
    await gesture(wrapper, [60, 50], [60, 50])
    await gesture(wrapper, [500, 500], [500, 500])
    expect(wrapper.emitted('frame-press')).toBeUndefined()
    expect(wrapper.emitted('cell-primary-down')).toBeDefined()
  })

  it('has no resize handle to grab when edit is off, but the Move handle always works (tickets 452, 473)', async () => {
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: false })
    await gesture(wrapper, [167, 127], [167, 127])
    expect(wrapper.emitted('frame-press')).toBeUndefined()

    pressMoveHandle(wrapper, [60, 50])
    const surface = wrapper.find('[data-testid="project-surface"]')
    await surface.trigger('pointermove', { buttons: 1, clientX: 60, clientY: 60, pointerId: 1 })
    expect(wrapper.emitted('frame-press')!.map(([target]) => target)).toEqual([{ kind: 'move' }])
    expect(wrapper.emitted('frame-drag')).toHaveLength(1)
  })

  it('scrolls the view toward the edge a dragged Frame touches, and moves the Frame with it', async () => {
    const frames: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: false })
    pressMoveHandle(wrapper, [60, 50])
    const surface = wrapper.find('[data-testid="project-surface"]')
    await surface.trigger('pointermove', { buttons: 1, clientX: 999, clientY: 400, pointerId: 1 })
    const drags = wrapper.emitted('frame-drag')!.length

    frames.splice(0).forEach((frame) => frame())
    await nextTick()

    const [dx, dy] = wrapper.emitted('pan')!.at(-1) as number[]
    expect(dx).toBeLessThan(0)
    expect(Math.abs(dy)).toBe(0)
    expect(wrapper.emitted('frame-drag')!.length).toBe(drags + 1)
  })

  it('does not scroll the view while the dragged Frame is away from the edges', async () => {
    const frames: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: false })
    pressMoveHandle(wrapper, [60, 50])
    await wrapper.find('[data-testid="project-surface"]').trigger('pointermove', { buttons: 1, clientX: 500, clientY: 400, pointerId: 1 })
    frames.splice(0).forEach((frame) => frame())
    await nextTick()
    expect(wrapper.emitted('pan')).toBeUndefined()
  })

  it('draws beads as usual with no Frame', async () => {
    const { wrapper } = await mountSurface(projectOf(4, 3, { frame: undefined }), 1)
    await gesture(wrapper, [25, 15], [25, 15])
    expect(wrapper.emitted('frame-press')).toBeUndefined()
    expect(wrapper.emitted('frame-anchor')!.at(-1)![0]).toBeUndefined()
    expect(wrapper.emitted('cell-primary-down')).toBeDefined()
  })

  it('moves the canvas with the Hand tool inside the Frame, since only the handles take a drag', async () => {
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: true, moving: true })
    await gesture(wrapper, [40, 30], [60, 50])
    expect(wrapper.emitted('frame-press')).toBeUndefined()
    expect(wrapper.emitted('pan')).toBeDefined()
  })

  it('drops a Frame drag when a second finger lands, and does not start another press with it', async () => {
    const { wrapper } = await mountSurface(framed(), 1, { x: 0, y: 0 }, { settingFrame: true })
    const surface = wrapper.find('[data-testid="project-surface"]')

    pressMoveHandle(wrapper, [60, 50], 'touch')
    await surface.trigger('pointerdown', { button: 0, clientX: 105, clientY: 75, pointerId: 2, pointerType: 'touch', isPrimary: false })

    expect(wrapper.emitted('frame-press')).toHaveLength(1)
    expect(wrapper.emitted('frame-cancel')).toHaveLength(1)
    await surface.trigger('pointermove', { buttons: 1, clientX: 45, clientY: 35, pointerId: 1, pointerType: 'touch', isPrimary: true })
    expect(wrapper.emitted('frame-drag')).toBeUndefined()
  })
})
