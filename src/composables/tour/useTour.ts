import { computed, inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import { BEAD_CATALOG } from '../../domain/beads'
import {
  frameGrid,
  moveToRow,
  projectDimensions,
  setRowProgressEnabled,
  withFrameGrid,
  type CreateProjectInput,
  type Project,
} from '../../domain/project'
import type { TourMarks } from '../../rendering/overlayRenderer'
import type { Selection } from '../../domain/selection'
import type { Tool } from '../../domain/tool'
import {
  TOUR_COLUMNS,
  TOUR_ROWS,
  TOUR_STEPS,
  afterStep,
  evaluateStep,
  tourTargets,
  type TourMemo,
  type TourSnapshot,
  type TourStepId,
} from '../../domain/tour'
import type { Translations } from '../../i18n/translations'
import type { TourProgress, TourStatus, TourStore } from '../../services/tourStore'
import { TOUR_ENABLED } from '../../features'
import type { EditFn } from '../project/useEdit'
import type { MessageTone } from '../ui/useToasts'

/** What the Tour reads from and does to the app; every dep is read lazily, so the shell can wire it after the rest. */
export interface TourDeps {
  store: TourStore
  currentProject: () => Project | undefined
  hasProject: (id: string) => boolean
  openProject: (id: string) => void
  /** Brings up the New Project form (no Project open). */
  openNewProjectForm: () => void
  activeTool: () => Tool
  selectedColorId: () => string | undefined
  selection: () => Selection | undefined
  pasteArmed: () => boolean
  edit: EditFn
  replaceProject: (project: Project) => void
  undo: () => void
  clearSelection: () => void
  /** The Name the New Project form holds right now. */
  draftName: () => string | undefined
  createProject: (input: CreateProjectInput) => void
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
}

/** The size, Technique and Bead every Tour Project is made with (TourProject in the design system). */
const TOUR_CREATE: Pick<CreateProjectInput, 'technique' | 'beadId' | 'size'> = {
  technique: 'loom',
  beadId: BEAD_CATALOG[0]!.id,
  size: { width: TOUR_COLUMNS, height: TOUR_ROWS, unit: 'beads' },
}

/** Bumped when the card's "Back to loom for your first Project" is pressed, so the New Project form sets itself back (Name kept). */
export const tourFormResetKey: InjectionKey<Ref<number>> = Symbol('tourFormReset')

export function provideTourFormReset(tick: Ref<number>) {
  provide(tourFormResetKey, tick)
}

export function useTourFormReset(): Ref<number> | undefined {
  return inject(tourFormResetKey, undefined)
}

/**
 * The Tour (CONTEXT.md; ticket 80): which step the visitor is on, when it moves on, and what Next, Skip and "start it
 * again" do. The rules are in domain/tour.ts; this holds the state on this device and does the steps' own edits. It is
 * a real walk through the real editor, so every edit goes through the same commit path the editor's own commands use.
 */
export function useTour(deps: TourDeps) {
  const status = ref<TourStatus>(TOUR_ENABLED ? deps.store.loadStatus() : 'off')
  const progress = ref<TourProgress>(deps.store.loadProgress())
  const memo = ref<TourMemo>({})
  /** The card after the last step, which stays until it is dismissed. */
  const finalCard = ref(false)
  const formResetTick = ref(0)

  const step = computed<TourStepId | undefined>(() =>
    status.value === 'running' ? TOUR_STEPS.find((candidate) => !progress.value.done.includes(candidate)) : undefined,
  )
  const stepNumber = computed(() => (step.value ? TOUR_STEPS.indexOf(step.value) + 1 : TOUR_STEPS.length))
  const active = computed(() => !!step.value || finalCard.value)

  const snapshot = computed<TourSnapshot>(() => {
    const project = deps.currentProject()
    return {
      projectId: project?.id,
      // The Tour reads the Frame it made; a canvas with none (drawn anywhere) is not the Tour's Project.
      columns: project?.frame?.columns ?? 0,
      rows: project?.frame?.rows ?? 0,
      grid: project?.frame ? frameGrid(project) : [],
      tool: deps.activeTool(),
      colorId: deps.selectedColorId(),
      selection: deps.selection(),
      pasteArmed: deps.pasteArmed(),
      rowProgress: project?.rowProgress ?? { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 },
    }
  })

  const targets = computed(() => {
    if (finalCard.value) {
      return { control: 'export' as const }
    }
    return step.value ? tourTargets(step.value, snapshot.value, memo.value) : undefined
  })

  /** What to outline on the Project: beads still to paint or erase, and the frames to select and paste into. */
  const marks = computed<TourMarks | undefined>(() => {
    const current = targets.value
    if (!current || !active.value) {
      return undefined
    }
    return { cells: current.cells ?? [], boxes: [...(current.box ? [current.box] : []), ...(current.pasteBoxes ?? [])] }
  })

  /** The Project is for looking at, not drawing on, unless the step is about drawing on it. */
  const canvasLocked = computed(() => active.value && targets.value?.control !== 'board')

  function setStatus(next: TourStatus) {
    status.value = next
    deps.store.saveStatus(next)
  }

  function setProgress(next: TourProgress) {
    progress.value = next
    deps.store.saveProgress(next)
  }

  function markDone(id: TourStepId) {
    if (progress.value.done.includes(id)) {
      return
    }
    const projectId = id === 'create' ? snapshot.value.projectId : progress.value.projectId
    setProgress({ done: [...progress.value.done, id], ...(projectId ? { projectId } : {}) })
    memo.value = {}
    if (TOUR_STEPS.every((candidate) => progress.value.done.includes(candidate))) {
      setStatus('finished')
      finalCard.value = true
    }
  }

  /** Step 1 works in the New Project form, so a Project left open (an earlier session's, say) steps aside. */
  function enterFirstStep() {
    if (deps.currentProject()) {
      deps.openNewProjectForm()
    }
  }

  function start() {
    setProgress({ done: [] })
    memo.value = {}
    finalCard.value = false
    setStatus('running')
    enterFirstStep()
  }

  /** A Tour whose Project is gone can't carry on from the middle, so it starts over at step 1. */
  function restartIfProjectGone(project: string | undefined) {
    const built = progress.value.projectId
    if (built && project !== built) {
      if (deps.hasProject(built)) {
        deps.openProject(built)
      } else {
        start()
      }
      return true
    }
    return false
  }

  if (step.value === 'create') {
    enterFirstStep()
  }

  watch(
    [step, snapshot],
    () => {
      const current = step.value
      if (!current) {
        return
      }
      if (current !== 'create' && restartIfProjectGone(snapshot.value.projectId)) {
        return
      }
      const result = evaluateStep(current, snapshot.value, memo.value)
      if (result.memo.sizeLeft !== memo.value.sizeLeft || result.memo.reachedRow3 !== memo.value.reachedRow3) {
        memo.value = result.memo
      }
      if (result.done) {
        markDone(current)
      }
    },
    { immediate: true },
  )

  /** Next does the step if it isn't done, so the Project always comes out whole. */
  function next() {
    const current = step.value
    if (!current) {
      return
    }
    const project = deps.currentProject()

    switch (current) {
      case 'create':
        if (!project || projectDimensions(project).columns !== TOUR_COLUMNS || projectDimensions(project).rows !== TOUR_ROWS) {
          deps.createProject({ name: deps.draftName(), ...TOUR_CREATE })
        }
        return
      case 'remove-line':
      case 'size':
        if (project && (projectDimensions(project).columns !== TOUR_COLUMNS || projectDimensions(project).rows !== TOUR_ROWS)) {
          deps.undo()
        }
        markDone(current)
        return
      case 'rows':
        if (project) {
          deps.replaceProject(moveToRow(setRowProgressEnabled(project, true), 2))
        }
        markDone(current)
        return
      default: {
        const stepIndex = { fill: 2, outline: 3, rhombus: 4, eye: 5, copy: 6, finish: 7, erase: 8 }[current]
        if (project && stepIndex) {
          deps.clearSelection()
          deps.edit('drawing', (current) => withFrameGrid(current, afterStep(stepIndex)))
        }
        markDone(current)
      }
    }
  }

  function skip() {
    finalCard.value = false
    if (status.value === 'running') {
      setStatus('off')
      deps.showToast('tour-off', deps.messages().tour.skipToast, 'info')
    }
  }

  function keepEditing() {
    finalCard.value = false
  }

  /** Creating a Project in step 1 always makes the Tour's own: Loom, the default Bead and 10×75, with the Name kept. */
  function normalizeCreate(input: CreateProjectInput): CreateProjectInput {
    return step.value === 'create' ? { ...input, ...TOUR_CREATE } : input
  }

  function backToLoom() {
    formResetTick.value++
  }

  return {
    status,
    step,
    stepNumber,
    stepCount: TOUR_STEPS.length,
    finalCard,
    active,
    targets,
    canvasLocked,
    marks,
    formResetTick,
    start,
    next,
    skip,
    keepEditing,
    backToLoom,
    normalizeCreate,
  }
}

export type TourContext = ReturnType<typeof useTour>
