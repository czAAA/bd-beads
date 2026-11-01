import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { CreateProjectInput } from '../../domain/createProject'
import type { PixelData } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { useAppPage } from '../shell/useAppPage'
import { useDialogs } from '../shell/useDialogs'
import { unusedCutOutService } from '../../testUtils/fakeCutOutService'
import { fakeCutOutDevice } from '../../testUtils/fakeCutOutDevice'
import { useConvertImageFlow } from './useConvertImageFlow'

const formValues: CreateProjectInput = { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: 'Fox' }
const picture = new File(['x'], 'fox.png', { type: 'image/png' })
const pixels = (): PixelData => ({ width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(200) })

function setup() {
  const dialogs = useDialogs()
  const appPage = useAppPage()
  const addProject = vi.fn<(project: Project) => void>()
  const flow = useConvertImageFlow({ dialogs, appPage, addProject, decodeImage: async () => pixels(), loadCatalog: () => Promise.reject(new Error('none')), cutOutService: unusedCutOutService, cutOutDevice: fakeCutOutDevice().device })
  return { dialogs, appPage, addProject, flow }
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

  it('opens on a new Project’s defaults when the form was never shown', () => {
    const { flow } = setup()
    flow.open()
    expect(flow.session.value?.technique.value).toBe('loom')
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
})
