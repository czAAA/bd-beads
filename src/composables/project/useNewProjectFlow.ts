import { computed, ref } from 'vue'
import type { ConvertedImage, PixelData } from '../../domain/imageConversion'
import type { StatedSize } from '../../domain/projectSize'
import {
  createProject,
  createProjectFromImage,
  projectGeometry,
  type CreateProjectInput,
  type Project,
} from '../../domain/project'

/** What creating a Project needs from the app shell: the library's add, and the picture Convert image is framing. */
export interface NewProjectFlowDeps {
  addProject: (project: Project) => void
  convertImage: () => PixelData | undefined
  cancelConvertImage: () => void
}

/** New-Project creation, blank or from Convert image (tickets 58, 196; ADR 0020). Deps are read lazily. */
export function useNewProjectFlow(deps: NewProjectFlowDeps) {
  /** The last form state that named a real size (a form with none is a Canvas): the frame and Create read it, so the
   * frame stays put while a width field is empty mid-retype. */
  const newProjectDraft = ref<(CreateProjectInput & { size: StatedSize }) | undefined>()

  function onNewProjectDraft(draft: CreateProjectInput) {
    // A draft with no size (a Canvas, or a field mid-retype) is no frame to follow: Convert image needs a size.
    if (!draft.size) {
      return
    }
    const sized = { ...draft, size: draft.size }
    const { width, height, unit } = sized.size
    const geometry = projectGeometry(sized)
    const wholeBeads = unit !== 'beads' || (Number.isInteger(width) && Number.isInteger(height))

    // A size the form would refuse (not whole beads) is no more a frame to follow than an empty field is.
    if (width > 0 && height > 0 && wholeBeads && geometry) {
      newProjectDraft.value = sized
    }
  }

  // What framing needs, or undefined when it isn't running: the picture and the frame the form implies, via the same
  // projectGeometry Create uses. One value gates all framing UI (form, canvas panel, zoom cluster) so they can't
  // disagree about whether framing is on.
  const framing = computed(() => {
    const image = deps.convertImage()
    const draft = newProjectDraft.value
    const geometry = draft && projectGeometry(draft)

    return image && draft && geometry
      ? {
          image,
          draft,
          technique: draft.technique,
          brickBlock: draft.brickBlock,
          bead: geometry.bead,
          dimensions: { columns: geometry.columns, rows: geometry.rows },
        }
      : undefined
  })

  function onCreateProject(payload: CreateProjectInput) {
    deps.addProject(createProject(payload))
  }

  // Creates the Project the frame was holding (ticket 58): an ordinary new Project arriving painted with the Image
  // colors (ADR 0011), from the framing preview grid. Cancel creates nothing, so it goes straight to the composable.
  function onConvertImageCreate(converted: ConvertedImage) {
    const draft = framing.value?.draft
    if (!draft) {
      return
    }

    deps.addProject(createProjectFromImage({ ...draft, grid: converted.grid }))
    deps.cancelConvertImage()
  }

  return { framing, newProjectDraft, onNewProjectDraft, onCreateProject, onConvertImageCreate }
}
