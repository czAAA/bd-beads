import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { FIRST_CONVERT_CHOICES, type ConvertChoices } from '../../domain/convertChoices'
import { NEW_PROJECT_DEFAULTS, type CreateProjectInput } from '../../domain/createProject'
import type { PixelData } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { useAppPage } from '../shell/useAppPage'
import { useDialogs } from '../shell/useDialogs'
import { useConvertImageFlow } from './useConvertImageFlow'

const formValues: CreateProjectInput = { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: 'Fox' }
const picture = new File(['x'], 'fox.png', { type: 'image/png' })
const pixels = (width = 8, height = 8): PixelData => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) })

function setup(decoded = pixels(), remembered: ConvertChoices = FIRST_CONVERT_CHOICES) {
  const convertChoices = ref(remembered)
  const dialogs = useDialogs()
  const appPage = useAppPage()
  const addProject = vi.fn<(project: Project) => void>()
  const onClosed = vi.fn()
  const addToCanvas = vi.fn()
  const flow = useConvertImageFlow({ dialogs, appPage, addProject, decodeImage: async () => decoded, loadCatalog: () => Promise.reject(new Error('none')), onClosed, addToCanvas, convertChoices })
  return { dialogs, appPage, addProject, onClosed, addToCanvas, convertChoices, flow }
}

/** Opens the converter and sets a picture, as the person does. */
async function openWithPicture() {
  const set = setup()
  set.flow.open(formValues)
  await set.flow.session.value!.setFile(picture)
  await nextTick()
  return set
}

describe('useConvertImageFlow', () => {
  it('opens from the reference image\'s All settings with its size, match and colors set, and adds the beads to the Canvas (ticket 0883)', async () => {
    const remembered: ConvertChoices = { beadId: 'toho/round/11-0', technique: 'loom', techniqueSettings: {} }
    const { appPage, addProject, addToCanvas, convertChoices, flow } = setup(pixels(120, 80), remembered)
    const request = { picture: new Blob(['x'], { type: 'image/png' }), name: 'fox.png', box: { row: 2, column: 3, rows: 20, columns: 30 }, source: 'exact' as const, colors: 1, hideAfter: true }
    await flow.openFromReference(request, formValues)
    const wizard = flow.session.value!
    expect(appPage.page.value).toBe('convert-image')
    expect(wizard.addsToCanvas).toBe(true)
    expect(wizard.dimensions.value).toEqual({ columns: 30, rows: 20 })
    expect(wizard.source.value).toBe('exact')
    expect(wizard.technique.value).toBe('peyote')
    flow.onCreate()
    expect(addProject).not.toHaveBeenCalled()
    expect(addToCanvas).toHaveBeenCalledWith(expect.objectContaining({ length: 20 }), request)
    expect(appPage.page.value).toBe('editor')
    expect(convertChoices.value).toEqual(remembered)
  })

  it('opens the converter page on the New Project form’s values', () => {
    const { appPage, flow } = setup()
    flow.open(formValues)
    expect(appPage.page.value).toBe('convert-image')
    expect(flow.session.value?.technique.value).toBe('peyote')
    expect(flow.session.value?.beadId.value).toBe('miyuki/delica/11-0')
  })

  it('opens it with a picture dropped or pasted on the app, on the form’s last values', async () => {
    const { appPage, flow } = setup()
    flow.onNewProjectDraft(formValues)
    expect(flow.onPicture(picture)).toBe(true)
    expect(appPage.page.value).toBe('convert-image')
    await vi.waitFor(() => expect(flow.session.value?.hasPicture.value).toBe(true))
    expect(flow.session.value?.technique.value).toBe('peyote')
  })

  it('opens on Miyuki Delica 11/0 in peyote on a device that has converted nothing, the form left alone (ticket 0893)', () => {
    const { flow } = setup()
    flow.open()
    expect(flow.session.value?.beadId.value).toBe('miyuki/delica/11-0')
    expect(flow.session.value?.technique.value).toBe('peyote')
  })

  it('keeps the last Create Project’s Bead, Technique with its Drop and source, and opens the next one on them (ticket 0893)', async () => {
    const { flow, convertChoices } = setup()
    flow.open({ ...NEW_PROJECT_DEFAULTS, beadId: 'toho/round/11-0', technique: 'brick' })
    const first = flow.session.value!
    first.setSetting('brickDrop', 2)
    first.setSource('exact')
    await first.setFile(picture)
    flow.onCreate()
    expect(convertChoices.value).toEqual({ beadId: 'toho/round/11-0', technique: 'brick', techniqueSettings: { brickDrop: 2 }, source: 'exact' })

    flow.onNewProjectDraft({ ...NEW_PROJECT_DEFAULTS })
    expect(flow.onPicture(picture)).toBe(true)
    const next = flow.session.value!
    expect(next).not.toBe(first)
    expect(next.beadId.value).toBe('toho/round/11-0')
    expect(next.techniqueSettings.value).toEqual({ brickDrop: 2 })
    expect(next.source.value).toBe('exact')
  })

  it('leaves a picture for another dialog that is showing, or for a page that is already open', () => {
    const { dialogs, appPage, flow } = setup()
    dialogs.flag('shortcuts').value = true
    expect(flow.onPicture(picture)).toBe(false)
    expect(flow.session.value).toBeUndefined()

    dialogs.flag('shortcuts').value = false
    flow.open(formValues)
    expect(appPage.page.value).toBe('convert-image')
    expect(flow.onPicture(picture)).toBe(false)
  })

  it('adds the Project the wizard made and goes back to the editor', async () => {
    const { appPage, addProject, flow } = await openWithPicture()
    flow.onCreate()
    expect(addProject).toHaveBeenCalledOnce()
    expect(appPage.page.value).toBe('editor')
    expect(flow.session.value).toBeUndefined()
  })

  it('creates nothing without a picture', () => {
    const { appPage, addProject, flow } = setup()
    flow.open(formValues)
    flow.onCreate()
    expect(addProject).not.toHaveBeenCalled()
    expect(appPage.page.value).toBe('convert-image')
  })

  it('closes at once with no picture set, asking nothing', async () => {
    const { dialogs, appPage, addProject, flow } = setup()
    flow.open(formValues)
    expect(await appPage.leave()).toBe(true)
    expect(dialogs.open.value).toBeUndefined()
    expect(appPage.page.value).toBe('editor')
    expect(addProject).not.toHaveBeenCalled()
  })

  it('asks "Leave the converter?" once a picture is set, and stays on Back to converter', async () => {
    const { dialogs, appPage, flow } = await openWithPicture()
    const left = appPage.leave()
    expect(dialogs.open.value).toBe('leave-converter')
    flow.onCancelLeave()
    expect(await left).toBe(false)
    expect(appPage.page.value).toBe('convert-image')
    expect(flow.session.value?.hasPicture.value).toBe(true)
    expect(dialogs.open.value).toBeUndefined()
  })

  it('leaves on Leave, dropping everything that was set up', async () => {
    const { appPage, addProject, flow } = await openWithPicture()
    const left = appPage.leave()
    flow.onConfirmLeave()
    expect(await left).toBe(true)
    expect(appPage.page.value).toBe('editor')
    expect(flow.session.value).toBeUndefined()
    expect(addProject).not.toHaveBeenCalled()
  })

  it('asks no more once the picture is gone with the page', async () => {
    const { appPage, flow } = await openWithPicture()
    const left = appPage.leave()
    flow.onConfirmLeave()
    await left
    expect(await appPage.leave()).toBe(true)
  })

  it('goes on to where the person came from once Close has left, at once with nothing set up', async () => {
    const { dialogs, onClosed, flow } = setup()
    flow.open(formValues)
    expect(await flow.onClose()).toBe(true)
    expect(dialogs.open.value).toBeUndefined()
    expect(onClosed).toHaveBeenCalledOnce()
  })

  it('goes nowhere when Close is answered with Back to converter, and on after Leave', async () => {
    const { appPage, onClosed, flow } = await openWithPicture()
    const stayed = flow.onClose()
    flow.onCancelLeave()
    expect(await stayed).toBe(false)
    expect(onClosed).not.toHaveBeenCalled()
    const left = flow.onClose()
    flow.onConfirmLeave()
    expect(await left).toBe(true)
    expect(appPage.page.value).toBe('editor')
    expect(onClosed).toHaveBeenCalledOnce()
  })

  it('goes nowhere after a Menu action leaves: that action says where', async () => {
    const { appPage, onClosed, flow } = setup()
    flow.open(formValues)
    await appPage.leave()
    expect(onClosed).not.toHaveBeenCalled()
  })
})
