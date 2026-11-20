import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createProject } from '../../domain/createProject'
import { ImageConversionError } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { newReferenceImage, withReferenceImage, type ReferencePicture } from '../../domain/referenceImage'
import type { Region, SurfaceView } from '../../rendering/surfaceView'
import { editHarness } from '../../testUtils/editHarness'
import { memoryPictureStore } from '../../testUtils/pictureStore'
import { useDialogs } from '../shell/useDialogs'
import { useReferenceImageFlow } from './useReferenceImageFlow'

const picture: ReferencePicture = { name: 'rose.webp', type: 'image/webp', width: 200, height: 100, bytes: 3 }
const tall: ReferencePicture = { name: 'tall.webp', type: 'image/webp', width: 100, height: 400, bytes: 4 }
/** A 4 × 4 Frame of cube beads, 20 grid px each: the Canvas's box is 80 × 80. */
const framed = (): Project => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })
const file = (name = 'rose.png') => new File(['x'], name, { type: 'image/png' })

function setup(project: Project | undefined = framed(), { refuses = false, prepared = picture, store = memoryPictureStore({ refuses }) } = {}) {
  const harness = editHarness(project)
  const ids = ref(project ? [project.id] : [])
  const dialogs = useDialogs()
  const deps = {
    currentProject: harness.currentProject,
    replaceProject: harness.replaceProject,
    libraryIds: () => ids.value,
    store,
    prepare: vi.fn(async (picked: File) => {
      if (picked.name.endsWith('.heic')) throw new ImageConversionError('heic')
      return { blob: new Blob([picked.name]), picture: prepared }
    }),
    decode: vi.fn(async () => ({ image: {} as CanvasImageSource, url: 'blob:picture', release: vi.fn() })),
    inView: () => undefined,
    bringIntoView: vi.fn<(locate: (surface: SurfaceView) => Region | undefined) => void>(),
    announce: vi.fn(),
    openProjectPanel: vi.fn(),
    closePanel: vi.fn(),
    dialogs,
  }
  const flow = useReferenceImageFlow(deps)
  return { harness, store, ids, deps, dialogs, flow }
}

describe('useReferenceImageFlow (ReferenceImage card, ticket 0790)', () => {
  it('fits a picked picture inside the Canvas\'s box, shown at 50%, keeps it on the device and puts the panel away to show it, no Undo step (ticket 1118)', async () => {
    const { harness, store, flow, deps } = setup()
    await flow.pick(file(), 'strip')
    expect(harness.project.referenceImage).toEqual({ picture, place: { x: 40, y: 40, width: 80, angle: 0 }, opacity: 50, shown: true })
    expect(store.kept.has(harness.project.id)).toBe(true)
    expect(deps.closePanel).toHaveBeenCalled()
    expect(flow.drawn.value).toMatchObject({ place: { x: 40, y: 40, width: 80, angle: 0 }, height: 40, opacity: 50 })
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('says why a file is refused, changes nothing, and opens the Project panel on it when picked from the strip', async () => {
    const { harness, flow, deps } = setup()
    await flow.pick(file('photo.heic'), 'panel')
    expect(flow.refusal.value).toBe('heic')
    expect(deps.openProjectPanel).not.toHaveBeenCalled()
    await flow.pick(file('photo.heic'), 'strip')
    expect(deps.openProjectPanel).toHaveBeenCalled()
    expect(harness.project.referenceImage).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })

  it('replaces the picture in its place, turn and width, leaving the panel open', async () => {
    const placed = withReferenceImage(framed(), { ...newReferenceImage(picture, { x: 0, y: 0, width: 80, height: 80 }), place: { x: 5, y: 6, width: 30, angle: 45 } })
    const { harness, flow, deps } = setup(placed, { prepared: tall })
    await flow.pick(file('tall.png'), 'panel')
    expect(harness.project.referenceImage).toMatchObject({ picture: tall, place: { x: 5, y: 6, width: 30, angle: 45 } })
    expect(deps.closePanel).not.toHaveBeenCalled()
  })

  it('replaces the picture from the picture bar; a refusal there opens the Project panel on it (ticket 0883)', async () => {
    const placed = withReferenceImage(framed(), { ...newReferenceImage(picture, { x: 0, y: 0, width: 80, height: 80 }), place: { x: 5, y: 6, width: 30, angle: 45 } })
    const { harness, flow, deps } = setup(placed, { prepared: tall })
    await flow.pick(file('tall.png'), 'bar')
    expect(harness.project.referenceImage).toMatchObject({ picture: tall, place: { x: 5, y: 6, width: 30, angle: 45 } })
    await flow.pick(file('photo.heic'), 'bar')
    expect(flow.refusal.value).toBe('heic')
    expect(deps.openProjectPanel).toHaveBeenCalled()
  })

  it('shows, hides and sets the opacity as views saved with the Project', async () => {
    const { harness, flow } = setup()
    await flow.pick(file(), 'panel')
    flow.toggleShown()
    expect(harness.project.referenceImage!.shown).toBe(false)
    expect(flow.drawn.value).toBeUndefined()
    flow.setOpacity(100)
    expect(harness.project.referenceImage).toMatchObject({ opacity: 100, shown: false })
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('brings the picture into view as it is shown, not as it is hidden (ticket 1011)', async () => {
    const { flow, deps } = setup()
    await flow.pick(file(), 'panel')
    flow.toggleShown()
    expect(deps.bringIntoView).not.toHaveBeenCalled()
    flow.toggleShown()
    // At 200%, the grid's first point at (10, 20): the 80 × 40 picture centred on (40, 40) lies at (10, 60), 160 × 80.
    const surface = { gridToPoint: (x: number, y: number) => ({ x: x * 2 + 10, y: y * 2 + 20 }) } as SurfaceView
    expect(deps.bringIntoView.mock.calls[0][0](surface)).toEqual({ x: 10, y: 60, width: 160, height: 80 })
  })

  it('lays the picture over the beads for the session, not saved nor an Undo step, back under in another Project (ticket 1009)', async () => {
    const { harness, flow } = setup()
    await flow.pick(file(), 'panel')
    expect(flow.drawn.value!.over).toBe(false)
    flow.setOver(true)
    expect(flow.over.value).toBe(true)
    expect(flow.drawn.value!.over).toBe(true)
    expect(harness.project.referenceImage).not.toHaveProperty('over')
    expect(harness.history.canUndo.value).toBe(false)
    const first = harness.project
    harness.replaceProject(framed())
    await flushPromises()
    harness.replaceProject(first)
    await flushPromises()
    expect(flow.over.value).toBe(false)
  })

  it('asks before removing the picture, then takes it off the Project and the device', async () => {
    const { harness, store, flow, dialogs } = setup()
    await flow.pick(file(), 'panel')
    flow.requestRemove()
    expect(dialogs.open.value).toBe('remove-reference-image')
    flow.cancelRemove()
    expect(harness.project.referenceImage).toBeDefined()
    flow.requestRemove()
    await flow.confirmRemove()
    expect(harness.project.referenceImage).toBeUndefined()
    expect(store.kept.size).toBe(0)
  })

  it('shows a picture the device won\'t keep for the session, and says it is not saved', async () => {
    const { flow } = setup(framed(), { refuses: true })
    await flow.pick(file(), 'panel')
    expect(flow.drawn.value).toBeDefined()
    expect(flow.notSaved.value).toBe(true)
  })

  it('draws the kept picture again when its Project is opened', async () => {
    const project = withReferenceImage(framed(), newReferenceImage(picture, { x: 0, y: 0, width: 80, height: 80 }))
    const store = memoryPictureStore()
    await store.put(project.id, new Blob(['kept']))
    const { flow } = setup(project, { store })
    await flushPromises()
    expect(flow.drawn.value).toBeDefined()
    expect(flow.thumbnail.value).toBe('blob:picture')
  })

  it('drops a picture whose Project left the library, and every picture of none at start', async () => {
    const { store, ids, flow } = setup()
    await flow.pick(file(), 'panel')
    ids.value = []
    await flushPromises()
    expect(store.kept.size).toBe(0)

    const stray = memoryPictureStore()
    await stray.put('gone', new Blob(['x']))
    setup(framed(), { store: stray })
    await flushPromises()
    expect(stray.kept.has('gone')).toBe(false)
  })

  it('gives every Project\'s picture to an export', async () => {
    const { harness, flow } = setup()
    await flow.pick(file(), 'panel')
    expect([...(await flow.picturesOf([harness.project.id, 'none'])).keys()]).toEqual([harness.project.id])
  })

  it('keeps an imported Project\'s picture', async () => {
    const { store, flow } = setup()
    const blob = new Blob(['imported'])
    await flow.keepImported(new Map([['imported', blob]]))
    expect(store.kept.get('imported')).toBe(blob)
  })

  it('draws a handle\'s drag as it goes and saves it once, on release, announced', async () => {
    const { harness, flow, deps } = setup()
    await flow.pick(file(), 'strip')
    const saves = harness.replaceProject.mock.calls.length
    flow.preview({ x: 100, y: 100, width: 80, angle: 10 })
    expect(flow.drawn.value!.place).toEqual({ x: 100, y: 100, width: 80, angle: 10 })
    expect(harness.replaceProject.mock.calls.length).toBe(saves)
    flow.commit({ x: 100, y: 100, width: 80, angle: 10 }, 'Turned 10°')
    expect(harness.project.referenceImage!.place).toEqual({ x: 100, y: 100, width: 80, angle: 10 })
    expect(deps.announce).toHaveBeenCalledWith('Turned 10°')
  })
})
