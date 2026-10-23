<script setup lang="ts">
import { computed } from 'vue'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import IconButton from '../ui/IconButton.vue'
import type { OpenPanel } from '../../composables/shell/openPanel'

// The canvas box's header strip (tickets 143, 431, 473, ADR 0055; CanvasStrip card): Menu, Project and Frame, then
// Rotate · Rulers · Undo · Redo · zoom · Fit. Names nothing. While framing a picture it holds Menu and the framing
// zoom. On phone the middle scrolls sideways; Menu, Project and Frame stay put.
const props = defineProps<{
  project?: Project
  /** The open sheet, so Menu and Project show lit while theirs is open. */
  openPanel?: OpenPanel | null
  rulers?: boolean
  /** Whether the Frame panel is open, so the Frame button shows lit. */
  frameOpen?: boolean
  canUndo?: boolean
  canRedo?: boolean
  zoomPercent?: number
  /** The zoom range the buttons stop at, when it isn't the Project canvas's (the framing step has its own). */
  zoomMinPercent?: number
  zoomMaxPercent?: number
}>()
const emit = defineEmits<{
  'select-panel': [sheet: 'menu' | 'project']
  'toggle-frame': []
  'rotate-canvas': []
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
  frame: controlAction('strip-frame'),
  rotateCanvas: controlAction('rotate-canvas'),
  rulers: controlAction('rulers'),
  undo: controlAction('undo'),
  redo: controlAction('redo'),
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project, canUndo: () => !!props.canUndo, canRedo: () => !!props.canRedo }))
const frameEnabled = computed(() => actions.frame.enabled?.(deps.value) ?? true)
const min = computed(() => props.zoomMinPercent ?? MIN_ZOOM_PERCENT)
const max = computed(() => props.zoomMaxPercent ?? MAX_ZOOM_PERCENT)
</script>

<template>
  <div class="canvas-strip no-page-pan" data-testid="canvas-strip">
    <div class="canvas-strip__panels">
      <AppButton
        variant="text"
        :action="actions.menu"
        :selected="openPanel === 'menu' ? true : undefined"
        data-testid="strip-menu"
        @click="emit('select-panel', 'menu')"
      />
      <AppButton
        v-if="project"
        variant="text"
        :action="actions.project"
        :selected="openPanel === 'project' ? true : undefined"
        data-testid="strip-project"
        @click="emit('select-panel', 'project')"
      />
      <AppButton
        v-if="project?.frame"
        variant="text"
        :action="actions.frame"
        :deps="deps"
        :selected="frameOpen && frameEnabled"
        data-testid="strip-frame"
        @click="emit('toggle-frame')"
      />
    </div>
    <div class="canvas-strip__controls" data-testid="canvas-strip-controls">
      <template v-if="project">
        <IconButton variant="plain" :icon-size="18" :action="actions.rotateCanvas" :deps="deps" data-testid="strip-rotate-canvas" @click="emit('rotate-canvas')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.rulers" :deps="deps" :selected="rulers" data-testid="strip-rulers" @click="emit('toggle-rulers')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.undo" :deps="deps" data-testid="strip-undo" @click="emit('undo')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.redo" :deps="deps" data-testid="strip-redo" @click="emit('redo')" />
      </template>
      <template v-if="zoomPercent !== undefined">
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomOut" :disabled="zoomPercent <= min" :disabled-body="t.tooltips.zoomOutLimit" data-testid="zoom-out" @click="emit('zoom-out')" />
        <span class="canvas-strip__level" data-testid="zoom-level">{{ zoomPercent }}%</span>
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomIn" :disabled="zoomPercent >= max" :disabled-body="t.tooltips.zoomInLimit" data-testid="zoom-in" @click="emit('zoom-in')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomFit" data-testid="zoom-reset" @click="emit('reset')" />
      </template>
    </div>
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

/* Menu, Project and Frame all fit in a 320px window in the longest language (ticket 473). */
@media (max-width: 340px) {
  .canvas-strip {
    gap: var(--space-4);
    padding-left: var(--space-8);
  }
}

/* Menu, Project and Frame stay at the left edge of the strip, even on a phone. */
.canvas-strip__panels {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

/*
 * The canvas controls sit to the right of them. On a phone, too narrow for the cluster, it scrolls sideways.
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

/* A finger needs a bigger target than the pointer's 30px (responsive.md "Input, not width"). */
@media (pointer: coarse) {
  .canvas-strip__controls :deep(.icon-btn--plain) {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
