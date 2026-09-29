import { computed, ref } from 'vue'
import type { ConvertedImage, PixelData } from '../domain/imageConversion'
import {
  createPattern,
  createPatternFromImage,
  patternGeometry,
  type CreatePatternInput,
  type Pattern,
} from '../domain/pattern'

/** What creating a Pattern needs from the app shell: the library's add, and the picture Convert image is framing. */
export interface NewPatternFlowDeps {
  addPattern: (pattern: Pattern) => void
  convertImage: () => PixelData | undefined
  cancelConvertImage: () => void
}

/** New-Pattern creation, blank or from Convert image (tickets 58, 196; ADR 0023). Deps are read lazily. */
export function useNewPatternFlow(deps: NewPatternFlowDeps) {
  /**
   * The last New Pattern form state that named a real size. The frame follows the form's fields as they're edited
   * during framing, and this is what a Create reads — holding the last *valid* state rather than the live one is what
   * keeps the frame put while a width field is momentarily empty mid-retype, instead of collapsing it to a single cell.
   */
  const newPatternDraft = ref<CreatePatternInput | undefined>()

  function onNewPatternDraft(draft: CreatePatternInput) {
    const { width, height, unit } = draft.size
    const geometry = patternGeometry(draft)
    const wholeBeads = unit !== 'beads' || (Number.isInteger(width) && Number.isInteger(height))

    // A size the form would refuse (not whole beads) is no more a frame to follow than an empty field is.
    if (width > 0 && height > 0 && wholeBeads && geometry) {
      newPatternDraft.value = draft
    }
  }

  /**
   * Everything the framing step needs, or undefined when it isn't running: the picture, and the frame the form's
   * current values imply — the Bead, the Technique and the grid size, read through the same patternGeometry the Pattern
   * itself will be created from, so the frame can't disagree with what Create makes.
   *
   * One value gates all three pieces of framing UI (the form staying up, the canvas panel, the zoom cluster), so they
   * can never disagree about whether framing is on — a canvas showing a frame with no Cancel button, say.
   */
  const framing = computed(() => {
    const image = deps.convertImage()
    const draft = newPatternDraft.value
    const geometry = draft && patternGeometry(draft)

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

  function onCreatePattern(payload: CreatePatternInput) {
    deps.addPattern(createPattern(payload))
  }

  /**
   * Creates the Pattern the frame was holding (ticket 58): an ordinary new Pattern that arrives painted, carrying the
   * conversion's Image colors (ADR 0011). The grid comes from the framing preview itself, so what was inside the frame
   * is literally what is created — see ConvertImageFrame.vue. Cancel, by contrast, creates nothing and keeps nothing
   * (ticket 58 decision), so it goes straight to the composable.
   */
  function onConvertImageCreate(converted: ConvertedImage) {
    const draft = framing.value?.draft
    if (!draft) {
      return
    }

    deps.addPattern(createPatternFromImage({ ...draft, grid: converted.grid, imageColors: converted.imageColors }))
    deps.cancelConvertImage()
  }

  return { framing, onNewPatternDraft, onCreatePattern, onConvertImageCreate }
}
