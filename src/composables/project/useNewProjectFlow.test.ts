import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { CreateProjectInput, Project } from '../../domain/project'
import type { ConvertedImage, PixelData } from '../../domain/imageConversion'
import { useNewProjectFlow } from './useNewProjectFlow'

const draft: CreateProjectInput = {
  technique: 'loom',
  beadId: 'toho-cube-1.5mm',
  size: { width: 3, height: 2, unit: 'beads' },
}

const picture: PixelData = { width: 1, height: 1, data: [0, 0, 0, 255] }

function setup() {
  const image = ref<PixelData>()
  const deps = {
    addProject: vi.fn<(project: Project) => void>(),
    convertImage: () => image.value,
    cancelConvertImage: vi.fn(),
  }
  return { image, deps, flow: useNewProjectFlow(deps) }
}

describe('useNewProjectFlow', () => {
  it('creates a blank Project from the form', () => {
    const { deps, flow } = setup()
    flow.onCreateProject(draft)
    expect(deps.addProject).toHaveBeenCalledOnce()
    expect(deps.addProject.mock.calls[0][0]).toMatchObject({ frame: { columns: 3, rows: 2 } })
  })

  it('creates an open canvas, with no Frame, when the form states no size', () => {
    const { deps, flow } = setup()
    flow.onCreateProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    const created = deps.addProject.mock.calls[0][0]
    expect(created.frame).toBeUndefined()
    expect(created.beads).toEqual({})
  })

  it('has no frame to follow from a draft with no size, and keeps the last one that had a size', () => {
    const { image, flow } = setup()
    image.value = picture
    flow.onNewProjectDraft({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    expect(flow.framing.value).toBeUndefined()

    flow.onNewProjectDraft(draft)
    flow.onNewProjectDraft({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    expect(flow.framing.value).toMatchObject({ dimensions: { columns: 3, rows: 2 } })
  })

  it('is not framing without a picture, or without a valid draft', () => {
    const { image, flow } = setup()
    flow.onNewProjectDraft(draft)
    expect(flow.framing.value).toBeUndefined()
    image.value = picture
    expect(flow.framing.value).toMatchObject({ dimensions: { columns: 3, rows: 2 } })
  })

  it('keeps the last valid draft while a field is momentarily invalid', () => {
    const { image, flow } = setup()
    image.value = picture
    flow.onNewProjectDraft(draft)
    flow.onNewProjectDraft({ ...draft, size: { width: 0, height: 2, unit: 'beads' } })
    flow.onNewProjectDraft({ ...draft, size: { width: 1.5, height: 2, unit: 'beads' } })
    expect(flow.framing.value?.dimensions).toEqual({ columns: 3, rows: 2 })
  })

  it('creates a painted Project from the framed picture and leaves framing', () => {
    const { image, deps, flow } = setup()
    image.value = picture
    flow.onNewProjectDraft(draft)
    const converted: ConvertedImage = {
      grid: [
        ['a', 'a', undefined],
        [undefined, 'b', 'b'],
      ],
      imageColors: [
        { id: 'a', hex: '#111111' },
        { id: 'b', hex: '#eeeeee' },
      ],
    } as unknown as ConvertedImage
    flow.onConvertImageCreate(converted)
    expect(deps.addProject).toHaveBeenCalledOnce()
    expect(deps.addProject.mock.calls[0][0]).toMatchObject({ frame: { columns: 3, rows: 2 }, imageColors: converted.imageColors })
    expect(deps.cancelConvertImage).toHaveBeenCalled()
  })

  it('creates nothing when not framing', () => {
    const { deps, flow } = setup()
    flow.onConvertImageCreate({ grid: [], imageColors: [] } as unknown as ConvertedImage)
    expect(deps.addProject).not.toHaveBeenCalled()
  })
})
