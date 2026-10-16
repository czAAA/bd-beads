<script setup lang="ts">
import { computed } from 'vue'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import IconButton from '../ui/IconButton.vue'
import type { PhoneSheet } from '../../composables/shell/phoneSheet'
import CanvasColorPicker from './CanvasColorPicker.vue'

/**
 * The canvas box's header strip (ticket 143, ADR 0055; CanvasStrip card): Menu and Project (icon + text, ticket 431),
 * then the canvas's own controls, Rulers · Undo · Redo · zoom out · zoom % · zoom in · Fit, and the Canvas color picker
 * last (ticket 425). Menu is always there; Project only with a Project open. It names nothing: no title, size line or
 * hint. While a picture is being framed (Convert image) it holds Menu and the framing step's own zoom. At phone width
 * Menu, Project and Canvas color stay put and the middle scrolls sideways, with touch-sized buttons.
 */
const props = defineProps<{
  project?: Project
  /** The open sheet, so Menu and Project show lit while theirs is open. */
  openSheet?: PhoneSheet | null
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
  'select-sheet': [sheet: 'menu' | 'project']
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
  menu: controlAction('strip-menu'),
  project: controlAction('strip-project'),
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
    <div class="canvas-strip__sheets">
      <AppButton
        variant="text"
        :action="actions.menu"
        :selected="openSheet === 'menu' ? true : undefined"
        data-testid="strip-menu"
        @click="emit('select-sheet', 'menu')"
      />
      <AppButton
        v-if="project"
        variant="text"
        :action="actions.project"
        :selected="openSheet === 'project' ? true : undefined"
        data-testid="strip-project"
        @click="emit('select-sheet', 'project')"
      />
    </div>
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
  gap: var(--space-8);
  box-sizing: border-box;
  height: var(--strip-height);
  padding: 0 var(--space-10) 0 var(--space-16);
  color: var(--ink);
  border-bottom: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
}

/* Menu and Project stay at the left edge of the strip, even on a phone. */
.canvas-strip__sheets {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

/*
 * The canvas controls sit to the right of them. On a phone, too narrow for the cluster, it scrolls sideways with
 * Canvas color pinned beside it.
 */
.canvas-strip__controls {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  margin-left: auto;
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
