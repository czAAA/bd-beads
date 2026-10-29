<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project } from '../../domain/project'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import RowProgressControls from './RowProgressControls.vue'
import { frameOf } from '../../domain/layerRecord'

// Progress bar (CONTEXT.md; tickets 144, 411, 426, ProgressBar card): every Row progress control, in one bar along the
// canvas box's bottom. On whenever there is a Frame (ADR 0055); without one it offers Fit to drawing. With a Frame its
// controls are RowProgressControls, the same the margin sheet carries (ticket 0657), moving the pointer like the hotkeys.
const props = withDefaults(defineProps<{
  project: Project
  /** Whether the Canvas draws the Row progress look (ticket 474): pressed while it does. */
  rowHighlight?: boolean
}>(), { rowHighlight: true })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  'toggle-row-direction': []
  'toggle-row-highlight': []
  /** The bar's own way to a Frame, shown while there is none to count rows on: Fit to drawing. */
  'fit-frame': []
}>()

const { t } = useI18n()

// One Tab stop; ←/→ step along the bar's controls and stop at the ends (ADR 0075).
const rootEl = ref<HTMLElement>()
const roving = useRovingFocus(rootEl, { axis: () => 'horizontal', managesTabIndex: true })

const fitFrame = controlAction('fit-to-drawing')
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

/** Row progress works on the Frame's rows, so with no Frame the bar can only ask for one. */
const hasFrame = computed(() => frameOf(props.project) !== undefined)
</script>

<template>
  <div ref="rootEl" class="progress-bar no-page-pan" data-testid="progress-bar" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
    <template v-if="!hasFrame">
      <!-- Styled like the CanvasHint, icons 14px to fit the 20px chips: "(Select chip) Select to set a (Frame chip) Frame", each icon in a chip. -->
      <p class="progress-bar__need" data-testid="progress-bar-needs-frame">
        <span class="hint-chip"><AppIcon name="select" :size="14" /></span>
        {{ t.frame.progressSelectToSet }}
        <span class="hint-chip"><AppIcon name="frame" :size="14" /></span>
        {{ t.frame.progressFrameWord }}
      </p>
      <span class="progress-bar__fit-frame">
        <AppButton variant="box" :action="fitFrame" :deps="deps" data-testid="progress-bar-fit-frame" @click="emit('fit-frame')" />
      </span>
    </template>
    <RowProgressControls
      v-else
      :project="project"
      :row-highlight="rowHighlight"
      form="bar"
      testid="progress-bar"
      @move-row="emit('move-row', $event)"
      @reset-progress="emit('reset-progress')"
      @toggle-row-direction="emit('toggle-row-direction')"
      @toggle-row-highlight="emit('toggle-row-highlight')"
    />
  </div>
</template>

<style scoped>
/* No Frame (ProgressBar card): "Select to set a Frame" set like the CanvasHint, and the Fit to drawing button pushed
 * to the right. */
.progress-bar__need {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin: 0;
  font: 400 0.75rem/1rem var(--font-sans);
  color: var(--muted);
  white-space: nowrap;
}

.progress-bar__fit-frame {
  margin-left: auto;
}

.progress-bar {
  container-type: inline-size;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-12);
  box-sizing: border-box;
  /* As tall as its tallest item plus 1px above and below (ticket 544); --progress-height is the same rule for the
   * Homepage's empty footer. The bottom corners follow the canvas box's curve. */
  min-height: var(--progress-height);
  padding: var(--bar-pad) var(--space-12) var(--bar-pad) var(--space-16);
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-bottom: 0;
  border-radius: 0 0 var(--canvas-box-radius) var(--canvas-box-radius);
}

/* Phone widths (ticket 411): the large buttons take a second row (RowProgressControls), so the bar wraps and is taller:
 * --progress-height (controls.css), which things above follow. */
@media (max-width: 30rem) {
  .progress-bar {
    flex-wrap: wrap;
    align-content: center;
    /* Remove frame, Edit Frame and Turn row direction share the first row with the counter and the track (ticket
     * 443): 4px between them keeps it one row at 320px, inside the 12px screen edge (ticket 450). */
    gap: var(--space-4);
    padding-inline: var(--space-4);
  }
}
</style>
