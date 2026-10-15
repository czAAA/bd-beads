<script setup lang="ts">
import { computed } from 'vue'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import CanvasColorPicker from './CanvasColorPicker.vue'

/**
 * The canvas box's header strip (ticket 143, ADR 0055; CanvasStrip card): the canvas's own controls, right-aligned,
 * Rulers · Undo · Redo · zoom out · zoom % · zoom in · Fit, then the Canvas color picker last (ticket 425). It names
 * nothing: no title, size line or hint. While a picture is being framed (Convert image) it holds the framing step's
 * own zoom alone. At phone width the cluster scrolls sideways, with touch-sized buttons.
 */
const props = defineProps<{

  project?: Project
  rulers?: boolean
  canUndo?: boolean
  canRedo?: boolean
  zoomPercent?: number
  /** The zoom range the buttons stop at, when it isn't the Project canvas's (the framing step has its own). */
  zoomMinPercent?: number
  zoomMaxPercent?: number
  /** Whether the Canvas color button shows (ticket 252): with a Project open on the drawing area. Shown in high contrast too, where it opens the Position marks choice alone. */
  canvasColor?: boolean
}>()
const emit = defineEmits<{
  'toggle-rulers': []
  undo: []
  redo: []
  'zoom-in': []
  'zoom-out': []
  reset: []
}>()

const { t } = useI18n()

/** Every button is a registry action, so its name, Tooltip, key and disabled reason come from there (ADR 0035). */
const actions = {
  rulers: controlAction('rulers'),
  undo: controlAction('undo'),
  redo: controlAction('redo'),
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project, canUndo: () => !!props.canUndo, canRedo: () => !!props.canRedo }))
const min = computed(() => props.zoomMinPercent ?? MIN_ZOOM_PERCENT)
const max = computed(() => props.zoomMaxPercent ?? MAX_ZOOM_PERCENT)
</script>

<template>
  <div class="canvas-strip" data-testid="canvas-strip">
    <div class="canvas-strip__controls" data-testid="canvas-strip-controls">
      <template v-if="project">
        <IconButton variant="plain" :icon-size="18" :action="actions.rulers" :deps="deps" :selected="rulers" data-testid="strip-rulers" @click="emit('toggle-rulers')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.undo" :deps="deps" data-testid="strip-undo" data-tour="undo" @click="emit('undo')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.redo" :deps="deps" data-testid="strip-redo" @click="emit('redo')" />
      </template>
      <template v-if="zoomPercent !== undefined">
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomOut" :disabled="zoomPercent <= min" :disabled-body="t.tooltips.zoomOutLimit" data-testid="zoom-out" @click="emit('zoom-out')" />
        <span class="canvas-strip__level" data-testid="zoom-level">{{ zoomPercent }}%</span>
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomIn" :disabled="zoomPercent >= max" :disabled-body="t.tooltips.zoomInLimit" data-testid="zoom-in" @click="emit('zoom-in')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomFit" data-testid="zoom-reset" @click="emit('reset')" />
      </template>
    </div>
    <div v-if="canvasColor" class="canvas-strip__color"><CanvasColorPicker /></div>
  </div>
</template>

<style scoped>
.canvas-strip {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-8);
  box-sizing: border-box;
  height: var(--strip-height);
  padding: 0 var(--space-10) 0 var(--space-16);
  color: var(--ink);
  border-bottom: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
}

/* The cluster scrolls sideways when the strip is too narrow for it (a phone); Canvas color stays pinned beside it. */
.canvas-strip__controls {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.canvas-strip__controls::-webkit-scrollbar {
  display: none;
}

.canvas-strip__controls > :deep(*) {
  flex: none;
}

.canvas-strip__level {
  flex: none;
  width: var(--zoom-level-width);
  font: var(--type-meta);
  color: var(--ink);
  text-align: center;
}

.canvas-strip__color {
  display: flex;
  flex: none;
}

/* A finger needs a bigger target than the pointer's 30px (responsive.md "Input, not width"). */
@media (pointer: coarse) {
  .canvas-strip__controls :deep(.icon-btn--plain) {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
