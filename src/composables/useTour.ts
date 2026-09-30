import { computed, inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import { BEAD_CATALOG } from '../domain/beads'
import {
  moveToRow,
  setRowProgressEnabled,
  type CreatePatternInput,
  type Pattern,
} from '../domain/pattern'
import type { TourMarks } from '../rendering/overlayRenderer'
import type { Selection } from '../domain/selection'
import type { Tool } from '../domain/tool'
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
} from '../domain/tour'
import type { Translations } from '../i18n/translations'
import type { TourProgress, TourStatus, TourStore } from '../services/tourStore'
import type { MessageTone } from './useToasts'

/** What the Tour reads from and does to the app; every dep is read lazily, so the shell can wire it after the rest. */
export interface TourDeps {
  store: TourStore
  currentPattern: () => Pattern | undefined
  hasPattern: (id: string) => boolean
  openPattern: (id: string) => void
  /** Brings up the New Pattern form (no Pattern open). */
  openNewPatternForm: () => void
  activeTool: () => Tool
  selectedColorId: () => string | undefined
  selection: () => Selection | undefined
  pasteArmed: () => boolean
  commitGridChange: (pattern: Pattern, updated: Pattern) => void
  replacePattern: (pattern: Pattern) => void
  undo: () => void
  clearSelection: () => void
  /** The Name the New Pattern form holds right now. */
  draftName: () => string | undefined
  createPattern: (input: CreatePatternInput) => void
  showToast: (id: string, text: string, tone?: MessageTone) => void
  messages: () => Translations
}

/** The size, Technique and Bead every Tour Pattern is made with (TourPattern in the design system). */
const TOUR_CREATE: Pick<CreatePatternInput, 'technique' | 'beadId' | 'size'> = {
  technique: 'loom',
  beadId: BEAD_CATALOG[0]!.id,
  size: { width: TOUR_COLUMNS, height: TOUR_ROWS, unit: 'beads' },
}

/** Bumped when the card's "Back to loom for your first Pattern" is pressed, so the New Pattern form sets itself back (Name kept). */
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
  const status = ref<TourStatus>(deps.store.loadStatus())
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
    const pattern = deps.currentPattern()
    return {
      patternId: pattern?.id,
      columns: pattern?.columns ?? 0,
      rows: pattern?.rows ?? 0,
      grid: pattern?.grid ?? [],
      tool: deps.activeTool(),
      colorId: deps.selectedColorId(),
      selection: deps.selection(),
      pasteArmed: deps.pasteArmed(),
      rowProgress: pattern?.rowProgress ?? { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 },
    }
  })

  const targets = computed(() => {
    if (finalCard.value) {
      return { control: 'export' as const }
    }
    return step.value ? tourTargets(step.value, snapshot.value, memo.value) : undefined
  })

  /** What to outline on the Pattern: beads still to paint or erase, and the frames to select and paste into. */
  const marks = computed<TourMarks | undefined>(() => {
    const current = targets.value
    if (!current || !active.value) {
      return undefined
    }
    return { cells: current.cells ?? [], boxes: [...(current.box ? [current.box] : []), ...(current.pasteBoxes ?? [])] }
  })

  /** The Pattern is for looking at, not drawing on, unless the step is about drawing on it. */
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
    const patternId = id === 'create' ? snapshot.value.patternId : progress.value.patternId
    setProgress({ done: [...progress.value.done, id], ...(patternId ? { patternId } : {}) })
    memo.value = {}
    if (TOUR_STEPS.every((candidate) => progress.value.done.includes(candidate))) {
      setStatus('finished')
      finalCard.value = true
    }
  }

  /** Step 1 works in the New Pattern form, so a Pattern left open (an earlier session's, say) steps aside. */
  function enterFirstStep() {
    if (deps.currentPattern()) {
      deps.openNewPatternForm()
    }
  }

  function start() {
    setProgress({ done: [] })
    memo.value = {}
    finalCard.value = false
    setStatus('running')
    enterFirstStep()
  }

  /** A Tour whose Pattern is gone can't carry on from the middle, so it starts over at step 1. */
  function restartIfPatternGone(pattern: string | undefined) {
    const built = progress.value.patternId
    if (built && pattern !== built) {
      if (deps.hasPattern(built)) {
        deps.openPattern(built)
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
      if (current !== 'create' && restartIfPatternGone(snapshot.value.patternId)) {
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

  /** Next does the step if it isn't done, so the Pattern always comes out whole. */
  function next() {
    const current = step.value
    if (!current) {
      return
    }
    const pattern = deps.currentPattern()

    switch (current) {
      case 'create':
        if (!pattern || pattern.columns !== TOUR_COLUMNS || pattern.rows !== TOUR_ROWS) {
          deps.createPattern({ name: deps.draftName(), ...TOUR_CREATE })
        }
        return
      case 'remove-line':
      case 'size':
        if (pattern && (pattern.columns !== TOUR_COLUMNS || pattern.rows !== TOUR_ROWS)) {
          deps.undo()
        }
        markDone(current)
        return
      case 'rows':
        if (pattern) {
          deps.replacePattern(moveToRow(setRowProgressEnabled(pattern, true), 2))
        }
        markDone(current)
        return
      default: {
        const stepIndex = { fill: 2, outline: 3, rhombus: 4, eye: 5, copy: 6, finish: 7, erase: 8 }[current]
        if (pattern && stepIndex) {
          deps.clearSelection()
          deps.commitGridChange(pattern, { ...pattern, grid: afterStep(stepIndex) })
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

  /** Creating a Pattern in step 1 always makes the Tour's own: Loom, the default Bead and 10×75, with the Name kept. */
  function normalizeCreate(input: CreatePatternInput): CreatePatternInput {
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
