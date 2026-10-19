import { computed, ref } from 'vue'
import type { GridPosition } from '../../domain/grid'
import { clampAxisCount, NO_MIRROR_AXES, type MirrorAxisCounts } from '../../domain/mirror'
import { onLayer } from '../../domain/layers'
import { keepAllowedEdits } from '../../domain/allowedEdits'
import { changedPositions } from '../../domain/canvas'
import { mirrorCurrent, type Project, projectDimensions } from '../../domain/project'
import type { EditFn } from '../project/useEdit'

/** Which "Mirror current" button an interaction names -- grid-space-neutral, since screen left-right/top-bottom is a
 * view-layer concern (Toolbox.vue) that swaps under rotation. */
export type MirrorCurrentAxis = 'horizontal' | 'vertical'

function gridAxisOf(axis: MirrorCurrentAxis): 'columns' | 'rows' {
  return axis === 'horizontal' ? 'columns' : 'rows'
}

// Mirror's own session state (ticket 62; ADR 0006 amendment): axis counts, copy mode, hover state, previews and "Mirror
// current". Not saved with the Project; reset via the shell's single reset point (see reset()). `currentProject` and
// `edit` come from the shell: it commits as a drawing Edit (ADR 0036), like Fill.
export function useMirrorState(
  currentProject: () => Project | undefined,
  edit: EditFn,
) {
  /** Per-direction axis counts, in grid space (see domain/mirror.ts). */
  const axisCounts = ref<MirrorAxisCounts>({ ...NO_MIRROR_AXES })
  /** Copy mode (ticket 45): strips repeat unflipped (A | A | A) instead of mirror-imaging (A | A' | A) when on. */
  const copyMode = ref(false)
  /** Which "Mirror current" button, if any, the pointer is over right now (ticket 47); null when the pointer is off
   * both. */
  const hoveredCurrentAxis = ref<MirrorCurrentAxis | null>(null)

  // Axis counts as shown on the canvas (ticket 47): while the pointer is over a "Mirror current" button, that direction
  // previews at its effective count (count-acts-as-1, ticket 46) without touching the stored count. Otherwise exactly
  // axisCounts.
  const previewedAxisCounts = computed<MirrorAxisCounts>(() => {
    const hovered = hoveredCurrentAxis.value
    if (!hovered) {
      return axisCounts.value
    }

    const axis = gridAxisOf(hovered)
    return { ...axisCounts.value, [axis]: axisCounts.value[axis] || 1 }
  })

  /** Cells a hovered "Mirror current" button would overwrite, dimmed on the canvas (ticket 47) -- computed by asking
   * mirrorCurrent what it *would* do and diffing that against what's there now, through the same Row progress lock
   * a real click would go through, so a locked cell that couldn't actually change is never dimmed. */
  const currentDimmedCells = computed<GridPosition[]>(() => {
    const project = currentProject()
    const hovered = hoveredCurrentAxis.value
    if (!project || !hovered) {
      return []
    }

    const axis = gridAxisOf(hovered)
    const result = keepAllowedEdits(project, mirroredCurrent(project, axis))
    const origin = project.frame ?? { row: 0, column: 0 }

    // Mirror works on the Frame's beads, which are counted from its first row and column.
    return changedPositions(project.frame?.beads ?? {}, result.frame?.beads ?? {}).map(({ row, column }) => ({ row: row + origin.row, column: column + origin.column }))
  })

  /** "Mirror current" on the Frame, the only layer with strips to mirror (ADR 0066). */
  function mirroredCurrent(project: Project, axis: 'columns' | 'rows'): Project {
    return onLayer(project, 'frame', (view) => mirrorCurrent(view, axis, axisCounts.value[axis], copyMode.value))
  }

  function onHoverCurrent(axis: MirrorCurrentAxis | null) {
    hoveredCurrentAxis.value = axis
  }

  /** Sets one direction's axis count (ticket 44), clamped to what the open Project's current size allows --
   * Toolbox.vue works out which grid-space field a screen direction maps to, since that's the piece that swaps
   * under rotation. */
  function setAxisCount(axis: 'columns' | 'rows', count: number) {
    const project = currentProject()
    if (!project) {
      return
    }

    const cellsAcross = axis === 'columns' ? projectDimensions(project).columns : projectDimensions(project).rows
    axisCounts.value = { ...axisCounts.value, [axis]: clampAxisCount(count, cellsAcross) }
  }

  function toggleCopyMode() {
    copyMode.value = !copyMode.value
  }

  // One-time reflect across one direction (ADR 0006, ticket 46): the strip with the most painted cells is the source,
  // using that direction's axis count and copy mode; a count of 0 acts as a single center axis so the button always
  // does something. Commits as a drawing Edit (ticket 62).
  function mirrorCurrentAction(axis: MirrorCurrentAxis) {
    const gridAxis = gridAxisOf(axis)
    edit('drawing', (project) => mirroredCurrent(project, gridAxis))
  }

  /** Restores axis counts from an Undo/Redo snapshot (SizeSnapshot.mirrorAxisCounts) -- not a Project field, so
   * restoreSnapshot alone can't apply it. */
  function restoreAxisCounts(counts: MirrorAxisCounts) {
    axisCounts.value = counts
  }

  /** A change of the Frame resets just the axis counts (ADR 0036): the Frame they were clamped against no longer
   * matches, but copy mode and hover are unrelated to grid size and are left alone. */
  function clearAxisCounts() {
    axisCounts.value = { ...NO_MIRROR_AXES }
  }

  /** Mirror's whole session state resets on a Project switch (ticket 44/45 decision), through the app shell's
   * existing single reset point rather than a watcher of its own. */
  function reset() {
    axisCounts.value = { ...NO_MIRROR_AXES }
    copyMode.value = false
    hoveredCurrentAxis.value = null
  }

  return {
    axisCounts,
    copyMode,
    previewedAxisCounts,
    currentDimmedCells,
    onHoverCurrent,
    setAxisCount,
    toggleCopyMode,
    mirrorCurrent: mirrorCurrentAction,
    restoreAxisCounts,
    clearAxisCounts,
    reset,
  }
}
