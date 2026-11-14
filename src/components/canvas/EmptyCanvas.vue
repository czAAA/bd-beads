<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../ui/AppButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { DEFAULT_BEAD } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { beadCell, DEFAULT_TECHNIQUE } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { useHelpDevice } from '../../composables/ui/useKeyHints'
import { positionMarkBackground } from '../../rendering/positionMarks'
import { markLookOf } from '../../rendering/tonalTiles'
import { useCanvasBackground } from '../../theme/useCanvasBackground'

/** The canvas box with no Project open (tickets 158, 0748, 0840; EmptyCanvas card): the empty positions of New Project's
 * default Technique and Bead at 100%, on the Canvas's last Background, then the message and the slot. The message says
 * what was deleted when a delete emptied it, and is hidden while a panel is over it. */
const props = defineProps<{
  /** The name of the Project whose delete left no Project open, if one did. */
  deleted?: string
  /** A panel is over the Canvas (the Menu opens here on its New Project form): the panel is the message, so none shows
   * cut behind it. */
  quiet?: boolean
}>()
const emit = defineEmits<{
  /** The deleted message's Projects library link. */
  library: []
}>()
const { t } = useI18n()
const savedProjects = controlAction('saved-projects')
const title = computed(() => (props.deleted === undefined ? t.value.shell.canvasPlaceholder : fillBlanks(t.value.shell.canvasDeleted, { name: props.deleted })))
const { device } = useHelpDevice()
/** What to do: after a delete, open another or make one; otherwise make, open or import, then how to move the Canvas, in
 * finger words on touch (ticket 0846). */
const hint = computed(() => {
  if (props.deleted !== undefined) return t.value.shell.canvasDeletedHint
  const pan = device.value === 'touch' ? t.value.shell.canvasPlaceholderPanTouch : t.value.shell.canvasPlaceholderPan
  return `${t.value.shell.canvasPlaceholderHint} ${pan}`
})
const canvasBackground = useCanvasBackground()
const DEFAULT_CELL = beadCell(DEFAULT_BEAD, DEFAULT_TECHNIQUE)
const boardStyle = computed(() => {
  const pixelRatio = window.devicePixelRatio || 1
  const marks = positionMarkBackground({
    technique: DEFAULT_TECHNIQUE,
    cell: DEFAULT_CELL,
    deviceScale: pixelRatio,
    pixelRatio,
    ...markLookOf(canvasBackground.projectTheme.value),
  })
  return marks ? { '--empty-marks': `url(${marks.url})`, '--empty-marks-size': `${marks.width}px ${marks.height}px` } : undefined
})
</script>

<template>
  <div class="empty-canvas" data-testid="app-canvas-placeholder">
    <!-- The positions fill the entire container, behind the message. -->
    <span class="empty-canvas__board" :style="boardStyle" aria-hidden="true" />
    <div v-if="!quiet" class="empty-canvas__message" data-testid="empty-canvas-message">
      <p class="empty-canvas__title">{{ title }}</p>
      <p class="empty-canvas__hint">{{ hint }}</p>
      <AppButton v-if="deleted !== undefined" variant="link" :action="savedProjects" data-testid="empty-canvas-library" @click="emit('library')" />
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* Fill the entire canvas box so the dot board stretches edge to edge. */
.empty-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 160px;
}

/* The empty positions: cover the whole container, over the drawing area's Background. */
.empty-canvas__board {
  position: absolute;
  inset: 0;
  background: var(--empty-marks, none) 0 0 / var(--empty-marks-size, auto) repeat;
}

/* Message floats in the centre, over the positions. */
.empty-canvas__message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-10);
  padding: var(--space-24) var(--space-16);
  text-align: center;
}

.empty-canvas__title {
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.empty-canvas__hint {
  max-width: calc(var(--tooltip-wide) + var(--space-32) * 2);
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}
</style>
