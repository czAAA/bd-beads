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
function projectOf(columns: number, rows: number, extra: Partial<Project> = {}, technique: Technique = 'loom'): Project {
  const project = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  return { ...project, ...extra }
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

  it('keeps redrawing on zoom and scroll after a Frame press fades the margin outline in while a draw is waiting', async () => {
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

  it('fills the empty positions outside the Frame and its margin with marks as patterns, not as a shape each', async () => {
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

      await wrapper.setProps({ project: { ...project, rowProgress: { enabled: true, direction: 'rows', currentRow: 5, currentColumn: 0 } } })

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

  it('draws the Row progress marker on the overlay, and no marker while it is off', async () => {
    const progress = (enabled: boolean): RowProgress => ({ enabled, direction: 'rows', currentRow: 2, currentColumn: 0 })

    await mountSurface(projectOf(20, 10, { rowProgress: progress(false) }))
    const without = context.named('stroke').length

    context.calls.length = 0
    await mountSurface(projectOf(20, 10, { rowProgress: progress(true) }))
    // The marker is one stroked line, over whatever else the overlay strokes.
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
        return { ...painted, rowProgress: { enabled: true, direction: 'rows', currentRow: 2, currentColumn: 0 } }
      }
      const redShown = () => context.named('fillRect').some((call) => call.fillStyle === '#e63746')
      const finishedCentre = (project: Project) => centreOf(project, project.frame!.row, project.frame!.column)

      it('dims them by default, keeping the bead\'s own color', async () => {
        await mountSurface(weaving())

        expect(redShown()).toBe(false)
        expect(context.named('fillRect').some((call) => call.fillStyle === fadeOver('#e63746', DEFAULT_THEME.canvas, 0.6))).toBe(true)
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

      /** Far enough along the finished row to be past the Frame's last column: open canvas, not a bead of the Frame. */
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
        const project = { ...weaving(), rowProgress: { enabled: true, direction: 'columns' as const, currentRow: 0, currentColumn: 2 } }
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
        expect(context.named('fillRect').some((call) => call.fillStyle === fadeOver('#e63746', DEFAULT_THEME.canvas, 0.6))).toBe(false)
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
      const project = projectOf(20, 10)
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
      const project = projectOf(20, 10)
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
      const project = projectOf(20, 10)
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

    describe('over the Frame margin (ticket 276)', () => {
      const framed = () => projectOf(4, 4, { frame: { row: 10, column: 10, rows: 4, columns: 4 } })

      it('shows not-allowed over the margin for a tool that cannot place beads there, and the crosshair elsewhere', async () => {
        const project = framed()
        const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { blocksMargin: true })
        const surface = wrapper.find('[data-testid="project-surface"]')

        await surface.trigger('pointermove', centreOf(project, 8, 8))
        expect(surface.classes()).toContain('project-surface--refused')

        await surface.trigger('pointermove', centreOf(project, 2, 2))
        expect(surface.classes()).not.toContain('project-surface--refused')
      })

      it('refuses a press whose mirrored counterpart lands in the margin, though the pressed bead is outside it', async () => {
        const project = framed()
        const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { blocksMargin: true, previewCells: [{ row: 2, column: 2 }, { row: 8, column: 8 }] })

        await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { ...centreOf(project, 2, 2), button: 0, buttons: 1 })

        // The outline fades in on the overlay once refused: a dashed stroke is drawn.
        await vi.waitFor(() => expect(context.named('setLineDash').some(({ args }) => (args[0] as number[]).length > 0)).toBe(true))
      })

      it('keeps its own cursor for Erase, which still works there', async () => {
        const project = framed()
        const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { blocksMargin: false })
        const surface = wrapper.find('[data-testid="project-surface"]')

        await surface.trigger('pointermove', centreOf(project, 8, 8))

        expect(surface.classes()).not.toContain('project-surface--refused')
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
      const project = projectOf(20, 10)
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

    it('says nothing for a move in a gap, and hovers the bead again on coming back to it', async () => {
      const project = projectOf(20, 10, {}, 'brick')
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 1, 0), buttons: 0 })
      // Brick stitch's seam between two rows is on no bead.
      await surface.trigger('pointermove', { clientX: 10, clientY: 20.5, buttons: 0 })
      await surface.trigger('pointermove', { ...centreOf(project, 1, 0), buttons: 0 })

      expect(events(wrapper)['cell-hover']).toEqual([[1, 0], [1, 0]])
    })

    it('says nothing for a press in the seam between two rows of brick stitch', async () => {
      const project = projectOf(20, 10, {}, 'brick')
      const { wrapper } = await mountSurface(project)

      await wrapper.find('[data-testid="project-surface"]').trigger('pointerdown', { clientX: 10, clientY: 20.5, button: 0, buttons: 1 })

      expect(events(wrapper)['cell-primary-down']).toBeUndefined()
    })

    it('finds a bead anywhere on the open canvas: far from the first bead, and at negative positions', async () => {
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

    it('works out the bead at any zoom, on peyote\'s shifted rows and brick stitch\'s seams', async () => {
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

    it('shows a crosshair over a bead, and the ordinary cursor elsewhere', async () => {
      const project = projectOf(20, 10)
      const { wrapper } = await mountSurface(project)
      const surface = wrapper.find('[data-testid="project-surface"]')

      await surface.trigger('pointermove', { ...centreOf(project, 0, 0), buttons: 0 })
      expect(surface.classes()).toContain('project-surface--over-bead')

      await surface.trigger('pointerleave')
      expect(surface.classes()).not.toContain('project-surface--over-bead')
    })
  })

  describe('the hover preview', () => {
    it('is drawn on the overlay: the paint color faintly on each bead named', async () => {
      const { wrapper } = await mountSurface(projectOf(20, 10))
      context.calls.length = 0

      await wrapper.setProps({ previewCells: [{ row: 1, column: 2 }, { row: 1, column: 17 }], previewColor: '#e63746' })

      const faint = context.named('fillRect').filter((call) => call.globalAlpha === 0.6)
      expect(faint.map((call) => call.args)).toEqual([[41, 21, 18, 18], [341, 21, 18, 18]])
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

      expect(context.named('fillRect').filter((call) => call.globalAlpha === 0.3)).toHaveLength(6)
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

describe('ProjectSurface while setting the Frame', () => {
  /** A press at a point of the viewport, then moves and a release. */
  async function gesture(wrapper: Awaited<ReturnType<typeof mountSurface>>['wrapper'], from: [number, number], to: [number, number]) {
    const surface = wrapper.find('[data-testid="project-surface"]')
    await surface.trigger('pointerdown', { button: 0, clientX: from[0], clientY: from[1], pointerId: 1 })
    await surface.trigger('pointermove', { buttons: 1, clientX: to[0], clientY: to[1], pointerId: 1 })
    await surface.trigger('pointerup', { clientX: to[0], clientY: to[1], pointerId: 1 })
  }

  it('reports a press on the open canvas, the drag and the release, and draws no bead', async () => {
    const project = { ...projectOf(4, 3), frame: undefined }
    const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { settingFrame: true })
    await gesture(wrapper, [65, 45], [165, 85])

    expect(wrapper.emitted('frame-press')).toEqual([[{ kind: 'outside' }, { row: 2, column: 3 }]])
    expect(wrapper.emitted('frame-drag')).toEqual([[{ row: 4, column: 8 }]])
    expect(wrapper.emitted('frame-release')).toHaveLength(1)
    expect(wrapper.emitted('cell-primary-down')).toBeUndefined()
    expect(wrapper.emitted('cell-hover')).toBeUndefined()
  })

  it('tells a press inside the Frame from one on its handle and one outside it', async () => {
    const project = { ...projectOf(4, 3), frame: { row: 0, column: 0, columns: 4, rows: 3 } }
    const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { settingFrame: true })
    const surface = wrapper.find('[data-testid="project-surface"]')

    await surface.trigger('pointerdown', { button: 0, clientX: 40, clientY: 30, pointerId: 1 })
    await surface.trigger('pointerup', { pointerId: 1 })
    await surface.trigger('pointerdown', { button: 0, clientX: 500, clientY: 500, pointerId: 1 })
    await surface.trigger('pointerup', { pointerId: 1 })
    // The bottom-right handle stands on the corner of the Frame's line, 7px outside its beads.
    await surface.trigger('pointerdown', { button: 0, clientX: 87, clientY: 67, pointerId: 1 })
    await surface.trigger('pointerup', { pointerId: 1 })

    expect(wrapper.emitted('frame-press')!.map(([target]) => target)).toEqual([{ kind: 'inside' }, { kind: 'outside' }, { kind: 'handle', edges: ['bottom', 'right'] }])
  })

  it('draws beads as usual when the Frame is not being set', async () => {
    const { wrapper } = await mountSurface(projectOf(4, 3), 1)
    await gesture(wrapper, [25, 15], [25, 15])
    expect(wrapper.emitted('frame-press')).toBeUndefined()
    expect(wrapper.emitted('cell-primary-down')).toBeDefined()
  })

  it('moves the canvas, not the Frame, while the Hand tool is on', async () => {
    const { wrapper } = await mountSurface(projectOf(4, 3), 1, { x: 0, y: 0 }, { settingFrame: true, moving: true })
    await gesture(wrapper, [25, 15], [45, 35])
    expect(wrapper.emitted('frame-press')).toBeUndefined()
    expect(wrapper.emitted('pan')).toBeDefined()
  })

  it('drops a Frame drag when a second finger lands, and does not start another press with it', async () => {
    const project = { ...projectOf(4, 3), frame: undefined }
    const { wrapper } = await mountSurface(project, 1, { x: 0, y: 0 }, { settingFrame: true })
    const surface = wrapper.find('[data-testid="project-surface"]')

    await surface.trigger('pointerdown', { button: 0, clientX: 25, clientY: 15, pointerId: 1, pointerType: 'touch', isPrimary: true })
    await surface.trigger('pointerdown', { button: 0, clientX: 105, clientY: 75, pointerId: 2, pointerType: 'touch', isPrimary: false })

    expect(wrapper.emitted('frame-press')).toHaveLength(1)
    expect(wrapper.emitted('frame-cancel')).toHaveLength(1)
    await surface.trigger('pointermove', { buttons: 1, clientX: 45, clientY: 35, pointerId: 1, pointerType: 'touch', isPrimary: true })
    expect(wrapper.emitted('frame-drag')).toBeUndefined()
  })
})
