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
  /**
   * The last New Project form state that named a real size (a form with none is an open canvas, which has no frame to follow). The frame follows the form's fields as they're edited
   * during framing, and this is what a Create reads — holding the last *valid* state rather than the live one is what
   * keeps the frame put while a width field is momentarily empty mid-retype, instead of collapsing it to a single cell.
   */
  const newProjectDraft = ref<(CreateProjectInput & { size: StatedSize }) | undefined>()

  function onNewProjectDraft(draft: CreateProjectInput) {
    // A draft with no size (an open canvas, or a field mid-retype) is no frame to follow: Convert image needs a size.
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

  /**
   * Everything the framing step needs, or undefined when it isn't running: the picture, and the frame the form's
   * current values imply — the Bead, the Technique and the grid size, read through the same projectGeometry the Project
   * itself will be created from, so the frame can't disagree with what Create makes.
   *
   * One value gates all three pieces of framing UI (the form staying up, the canvas panel, the zoom cluster), so they
   * can never disagree about whether framing is on — a canvas showing a frame with no Cancel button, say.
   */
  const framing = computed(() => {
    const image = deps.convertImage()
    const draft = newProjectDraft.value
    const geometry = draft && projectGeometry(draft)

    return image && draft && geometry
      ? {
          image,
          draft,
          technique: draft.technique,
          bead: geometry.bead,
          dimensions: { columns: geometry.columns, rows: geometry.rows },
        }
      : undefined
  })

  function onCreateProject(payload: CreateProjectInput) {
    deps.addProject(createProject(payload))
  }

  /**
   * Creates the Project the frame was holding (ticket 58): an ordinary new Project that arrives painted, carrying the
   * conversion's Image colors (ADR 0011). The grid comes from the framing preview itself, so what was inside the frame
   * is literally what is created — see ConvertImageFrame.vue. Cancel, by contrast, creates nothing and keeps nothing
   * (ticket 58 decision), so it goes straight to the composable.
   */
  function onConvertImageCreate(converted: ConvertedImage) {
    const draft = framing.value?.draft
    if (!draft) {
      return
    }

    deps.addProject(createProjectFromImage({ ...draft, grid: converted.grid, imageColors: converted.imageColors }))
    deps.cancelConvertImage()
  }

  return { framing, newProjectDraft, onNewProjectDraft, onCreateProject, onConvertImageCreate }
}
