import { describe, expect, it, vi } from 'vitest'
import { createProject, type CreateProjectInput } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { useDialogs } from '../shell/useDialogs'
import { useConvertImageFlow } from './useConvertImageFlow'

const formValues: CreateProjectInput = { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: 'Fox' }
const picture = new File(['x'], 'fox.png', { type: 'image/png' })

function setup() {
  const dialogs = useDialogs()
  const addProject = vi.fn<(project: Project) => void>()
  return { dialogs, addProject, flow: useConvertImageFlow({ dialogs, addProject }) }
}

describe('useConvertImageFlow', () => {
  it('opens the wizard on the New Project form’s values', () => {
    const { dialogs, flow } = setup()
    flow.open(formValues)
    expect(dialogs.open.value).toBe('convert-image')
    expect(flow.start.value).toEqual({ draft: formValues })
  })

  it('opens it with a picture dropped or pasted on the app, on the form’s last values', () => {
    const { dialogs, flow } = setup()
    flow.onNewProjectDraft(formValues)
    expect(flow.onPicture(picture)).toBe(true)
    expect(dialogs.open.value).toBe('convert-image')
    expect(flow.start.value).toEqual({ draft: formValues, file: picture })
  })

  it('opens on a new Project’s defaults when the form was never shown', () => {
    const { flow } = setup()
    flow.onPicture(picture)
    expect(flow.start.value?.draft).toMatchObject({ technique: 'loom', name: '' })
  })

  it('leaves a picture for another dialog that is showing', () => {
    const { dialogs, flow } = setup()
    dialogs.flag('shortcuts').value = true
    expect(flow.onPicture(picture)).toBe(false)
    expect(flow.start.value).toBeUndefined()
  })

  it('adds the Project the wizard made and closes it', () => {
    const { dialogs, addProject, flow } = setup()
    flow.open(formValues)
    const made = createProject(formValues)
    flow.onCreate(made)
    expect(addProject).toHaveBeenCalledWith(made)
    expect(dialogs.open.value).toBeUndefined()
  })

  it('closes on Cancel and makes nothing', () => {
    const { dialogs, addProject, flow } = setup()
    flow.open(formValues)
    flow.onCancel()
    expect(dialogs.open.value).toBeUndefined()
    expect(addProject).not.toHaveBeenCalled()
  })
})
