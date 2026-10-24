<script setup lang="ts">
import { computed } from 'vue'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { overviewUrl } from '../../overview/overviewRoute'
import AppButton from '../ui/AppButton.vue'
import AppLogo from '../ui/AppLogo.vue'
import IconButton from '../ui/IconButton.vue'
import type { OpenPanel } from '../../composables/shell/openPanel'

// The canvas box's header strip on the editor and the Overview (tickets 143, 540, ADR 0055, ADR 0073; CanvasStrip card):
// three slots: Menu · Project · Frame on the left, the Brand in the middle, Rotate · Rulers · Undo · Redo and the zoom
// on the right (ticket 543). Under 1024px the words and the wordmark hide; on an editor phone there is no Brand.
const props = defineProps<{
  /** Which page the strip is on: the editor's Brand opens the Overview, the Overview's is the current page. */
  page?: 'editor' | 'overview'
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
const onOverview = computed(() => props.page === 'overview')
const overviewHref = overviewUrl(import.meta.env.BASE_URL)
</script>

<template>
  <div class="canvas-strip no-page-pan" :class="{ 'canvas-strip--overview': onOverview }" data-testid="canvas-strip">
    <div class="canvas-strip__panels">
      <AppButton
        variant="text"
        :action="actions.menu"
        :selected="openPanel === 'menu' ? true : undefined"
        data-testid="strip-menu"
        @click="emit('select-panel', 'menu')"
      >
        <span class="canvas-strip__label">{{ actions.menu.name(t) }}</span>
      </AppButton>
      <AppButton
        v-if="project"
        variant="text"
        :action="actions.project"
        :selected="openPanel === 'project' ? true : undefined"
        data-testid="strip-project"
        @click="emit('select-panel', 'project')"
      >
        <span class="canvas-strip__label">{{ actions.project.name(t) }}</span>
      </AppButton>
      <AppButton
        v-if="project?.frame"
        variant="text"
        :action="actions.frame"
        :deps="deps"
        :selected="frameOpen && frameEnabled"
        data-testid="strip-frame"
        @click="emit('toggle-frame')"
      >
        <span class="canvas-strip__label">{{ actions.frame.name(t) }}</span>
      </AppButton>
    </div>
    <!-- The Brand (tickets 540, 543): the strip's middle slot; the editor's opens the Overview, the Overview's is the page itself. -->
    <component
      :is="onOverview ? 'span' : 'a'"
      class="canvas-strip__brand"
      :href="onOverview ? undefined : overviewHref"
      :aria-current="onOverview ? 'page' : undefined"
      data-testid="canvas-brand"
    >
      <AppLogo class="canvas-strip__mark" :size="22" />
      <span class="canvas-strip__wordmark">{{ t.app.title }}</span>
    </component>
    <div class="canvas-strip__controls" data-testid="canvas-strip-controls">
      <div v-if="project" class="canvas-strip__tools">
        <IconButton variant="plain" :icon-size="18" :action="actions.rotateCanvas" :deps="deps" data-testid="strip-rotate-canvas" @click="emit('rotate-canvas')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.rulers" :deps="deps" :selected="rulers" data-testid="strip-rulers" @click="emit('toggle-rulers')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.undo" :deps="deps" data-testid="strip-undo" @click="emit('undo')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.redo" :deps="deps" data-testid="strip-redo" @click="emit('redo')" />
      </div>
      <div v-if="zoomPercent !== undefined" class="canvas-strip__zoom" :data-zoom-percent="zoomPercent" data-testid="canvas-strip-zoom">
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomOut" :disabled="zoomPercent <= min" :disabled-body="t.tooltips.zoomOutLimit" data-testid="zoom-out" @click="emit('zoom-out')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomIn" :disabled="zoomPercent >= max" :disabled-body="t.tooltips.zoomInLimit" data-testid="zoom-in" @click="emit('zoom-in')" />
        <IconButton variant="plain" :icon-size="18" :action="actions.zoomFit" data-testid="zoom-reset" @click="emit('reset')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Three slots (ticket 543): panels left, the Brand centred, the tools and zoom right. */
.canvas-strip {
  position: relative;
  display: grid;
  flex: none;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
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

.canvas-strip__panels {
  display: flex;
  align-items: center;
  justify-self: start;
  gap: var(--space-2);
}

/* Under 1024px the words go and the icons stay; the label stays in the page for a screen reader. */
@media (max-width: 1023px) {
  .canvas-strip__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}

/* The right slot holds the tools and the zoom as one cluster; on a phone, too narrow for it, it scrolls sideways. */
.canvas-strip__controls {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.canvas-strip__controls::-webkit-scrollbar {
  display: none;
}

.canvas-strip__tools,
.canvas-strip__zoom {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

.canvas-strip__brand {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  color: var(--ink);
  text-decoration: none;
}

.canvas-strip__mark {
  color: var(--accent);
}

.canvas-strip__wordmark {
  display: none;
  font: var(--type-brand);
  letter-spacing: var(--tracking-brand);
}

@media (min-width: 1024px) {
  .canvas-strip__wordmark {
    display: inline;
  }
}

a.canvas-strip__brand:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
  border-radius: var(--radius-xs);
}

/* The editor's phone strip has no Brand and gives the room to the controls; the Overview's keeps the logo. */
@media (max-width: 743px) {
  .canvas-strip:not(.canvas-strip--overview) {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .canvas-strip:not(.canvas-strip--overview) .canvas-strip__brand {
    display: none;
  }
}

/* A finger needs a bigger target than the pointer's 30px (responsive.md "Input, not width"). */
@media (pointer: coarse) {
  .canvas-strip__controls :deep(.icon-btn--plain) {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
