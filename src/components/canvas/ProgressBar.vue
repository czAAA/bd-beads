<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project } from '../../domain/project'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import RowProgressControls from './RowProgressControls.vue'
import type { RowPress } from '../../composables/project/useRowOps'
import { frameOf } from '../../domain/layerRecord'

// Progress bar (CONTEXT.md; tickets 144, 411, 426, ProgressBar card): every Row progress control along the canvas box's
// bottom; with no Frame (ADR 0055) Fit a Frame and export a picture (0847), with one its RowProgressControls (0657). The
// Homepage fills it with its sections through the slot, with no Project (0739); the editor with none leaves it empty (0748).
const props = withDefaults(defineProps<{
  /** The Project whose Row progress it shows; none where the slot fills the bar, or where the bar is empty. */
  project?: Project
  /** Whether the Canvas draws the Row progress look (ticket 474): pressed while it does. */
  rowHighlight?: boolean
  /** The last press of Row done or Row not done (ticket 0730): Row done flares the track's spark. */
  rowPress?: RowPress
}>(), { rowHighlight: true })

const emit = defineEmits<{
  'move-row': [delta: number]
  /** Reset progress, which asks first (ticket 455); it is only enabled once a row is done. */
  'reset-progress': []
  'toggle-row-direction': []
  'toggle-row-highlight': []
  /** The bar's own way to a Frame and a picture, shown while there is none to count rows on (ticket 0847, O-03): Fit
   * to drawing, then Export opened on Picture. */
  'fit-and-export': []
}>()

const { t } = useI18n()

// One Tab stop; ←/→ step along the bar's controls and stop at the ends (ADR 0075).
const rootEl = ref<HTMLElement>()
const roving = useRovingFocus(rootEl, { axis: () => 'horizontal', managesTabIndex: true })

const fitAndExport = controlAction('fit-and-export')
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

/** Row progress works on the Frame's rows, so with no Frame the bar can only ask for one. */
const hasFrame = computed(() => props.project !== undefined && frameOf(props.project) !== undefined)
</script>

<template>
  <div ref="rootEl" class="progress-bar no-page-pan" data-testid="progress-bar" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
    <slot>
    <template v-if="project && !hasFrame">
      <!-- Styled like the CanvasHint, icons 14px to fit the 20px chips: "(Select chip) Select to set a (Frame chip) Frame", each icon in a chip. -->
      <p class="progress-bar__need" data-testid="progress-bar-needs-frame">
        <span class="hint-chip"><AppIcon name="select" :size="14" /></span>
        {{ t.frame.progressSelectToSet }}
        <span class="hint-chip"><AppIcon name="frame" :size="14" /></span>
        {{ t.frame.progressFrameWord }}
      </p>
      <span class="progress-bar__fit-frame">
        <AppButton variant="box" :action="fitAndExport" :deps="deps" data-testid="progress-bar-fit-frame" @click="emit('fit-and-export')" />
      </span>
    </template>
    <RowProgressControls
      v-else-if="project"
      :project="project"
      :row-highlight="rowHighlight"
      :row-press="rowPress"
      form="bar"
      testid="progress-bar"
      @move-row="emit('move-row', $event)"
      @reset-progress="emit('reset-progress')"
      @toggle-row-direction="emit('toggle-row-direction')"
      @toggle-row-highlight="emit('toggle-row-highlight')"
    />
    </slot>
  </div>
</template>

<style scoped>
/* No Frame (ProgressBar card): "Select to set a Frame" set like the CanvasHint, and Fit a Frame and export a picture
 * pushed to the right. */
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
   * Homepage's empty footer. The bottom corners follow the canvas box's curve; 24 at both ends keeps what it holds off
   * the box's edge (ticket 0780). Where the app shell runs it to the screen's bottom edge over a safe-area inset (the
   * iPad's home indicator, ticket 0788), it grows by the inset and keeps what it holds above it. */
  min-height: calc(var(--progress-height) + var(--bar-bottom-inset, 0px));
  padding: var(--bar-pad) var(--space-24) calc(var(--bar-pad) + var(--bar-bottom-inset, 0px));
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-bottom: 0;
  border-radius: 0 0 var(--canvas-box-radius) var(--canvas-box-radius);
}

/* Phone widths (ticket 411): Row not done and Row done take a second row (RowProgressControls), so the bar wraps and is taller:
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
