<script setup lang="ts">
import { computed } from 'vue'
import { rowProgressPosition, type Project } from '../../domain/project'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'

/**
 * Progress bar (CONTEXT.md; tickets 144, 411, ProgressBar card): every Row progress control, in one short bar along the
 * canvas box's bottom edge, always shown at every width whatever the Project's shape. The switch comes first, so the
 * bar is there while Row progress is off: then only the switch and its label show, and the bar keeps its height so the
 * canvas doesn't jump. On, Turn row direction sits beside the switch; then come the current row, the finished share,
 * and the large Row not done and Row done buttons, whose label and arrow follow Row direction. They move the
 * current-row pointer exactly as the hotkeys do (D, Shift+Enter/Shift+Space, Enter/Space (ticket 178); P toggles the switch).
 */
const props = defineProps<{ project: Project }>()

const emit = defineEmits<{
  'move-row': [delta: number]
  'toggle-row-progress': [enabled: boolean]
  'toggle-row-direction': []
  /** The bar's own way to a Frame, shown while there is none to count rows on: Fit to drawing. */
  'fit-frame': []
}>()

const { t } = useI18n()

/** Every control here is a registry action: its name, Tooltip, key chip and disabled reason come from there (ADR 0035). */
const actions = {
  rowProgress: controlAction('row-progress'),
  fitFrame: controlAction('fit-to-drawing'),
  direction: controlAction('row-direction'),
  notDone: controlAction('row-not-done'),
  done: controlAction('row-done'),
}
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const enabled = computed({
  get: () => props.project.rowProgress.enabled && props.project.frame !== undefined,
  set: (on: boolean) => emit('toggle-row-progress', on),
})

/** Row progress works on the Frame's rows, so with no Frame the bar can only ask for one. */
const hasFrame = computed(() => props.project.frame !== undefined)

const position = computed(() => rowProgressPosition(props.project))

/** Rows before the current one are finished. */
const finishedShare = computed(() => (position.value.total > 0 ? position.value.current / position.value.total : 0))

const columnWise = computed(() => props.project.rowProgress.direction === 'columns')

/** Row done and Row not done name what is woven in the direction the rows run: a row, or a column (ticket 411). */
const doneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnNextButton : t.value.rowProgress.nextButton))
const notDoneLabel = computed(() => (columnWise.value ? t.value.rowProgress.columnPreviousButton : t.value.rowProgress.previousButton))

/** The row shown as current: the last one once every pass is done. */
const shownRow = computed(() => Math.min(position.value.current + 1, position.value.total))

const directionLabel = computed(() =>
  props.project.rowProgress.direction === 'rows' ? t.value.rowProgress.topToBottom : t.value.rowProgress.leftToRight,
)
</script>

<template>
  <div class="progress-bar" :class="{ 'progress-bar--off': !enabled }" data-testid="progress-bar">
    <AppSwitch v-model="enabled" :action="actions.rowProgress" :deps="deps" data-testid="progress-bar-switch" data-tour="progress-switch" />

    <template v-if="!hasFrame">
      <span class="progress-bar__row">{{ t.toolbox.groups.rowProgress }}</span>
      <span class="progress-bar__need" data-testid="progress-bar-needs-frame">{{ t.frame.progressNeedsFrame }}</span>
      <span class="progress-bar__fit-frame">
        <AppButton variant="box" :action="actions.fitFrame" :deps="deps" data-testid="progress-bar-fit-frame" @click="emit('fit-frame')" />
      </span>
    </template>
    <template v-else-if="enabled">
      <!-- Turn row direction sits beside the switch, away from the do/undo pair, so it can't be hit while doing rows (ticket 411). -->
      <IconButton
        variant="box"
        :action="actions.direction"
        :selected="columnWise"
        data-testid="progress-bar-direction"
        @click="emit('toggle-row-direction')"
      />
      <p class="progress-bar__position progress-bar__phone-hide" data-testid="progress-bar-position">
        <span class="progress-bar__row">{{ t.rowProgress.positionLabel }} {{ shownRow }}</span>
        {{ ' ' }}
        <span class="progress-bar__of">{{
          t.rowProgress.ofTotal.replace('{total}', String(position.total)).replace('{direction}', directionLabel)
        }}</span>
      </p>
      <!-- The compact counter (ticket 188): "1/222" in place of the spelled-out row count; the buttons keep their text (ticket 411). -->
      <p class="progress-bar__compact-position" data-testid="progress-bar-compact-position">
        {{ shownRow }}/{{ position.total }}
      </p>
      <div
        class="progress-bar__track"
        role="progressbar"
        :aria-label="t.rowProgress.finishedLabel"
        aria-valuemin="0"
        :aria-valuemax="position.total"
        :aria-valuenow="position.current"
        data-testid="progress-bar-track"
      >
        <span class="progress-bar__fill" :style="{ width: `${finishedShare * 100}%` }" />
      </div>
      <!-- Row not done and Row done are large text buttons whose label and arrow follow Row direction (ticket 411). -->
      <div class="progress-bar__steps" :class="{ 'progress-bar__steps--columns': columnWise }">
        <AppButton
          variant="box"
          size="lg"
          :action="actions.notDone"
          :label="notDoneLabel"
          icon="arrow-up"
          :disabled="position.current === 0"
          data-testid="progress-bar-previous"
          data-tour="progress-previous"
          @click="emit('move-row', -1)"
        />
        <AppButton
          variant="primary"
          size="lg"
          :action="actions.done"
          :label="doneLabel"
          trailing-icon="arrow-down"
          :disabled="position.current >= position.total"
          data-testid="progress-bar-next"
          data-tour="progress-next"
          @click="emit('move-row', 1)"
        />
      </div>
    </template>
    <span v-else class="progress-bar__off-label">{{ t.toolbox.groups.rowProgress }}</span>
  </div>
</template>

<style scoped>
/* No Frame (ProgressBar card): "Set Frame to start" in `meta`, and the Fit to drawing button pushed to the right. */
.progress-bar__need {
  font: var(--type-meta);
  color: var(--box-muted);
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
  height: var(--progress-height);
  padding: 0 var(--space-12) 0 var(--space-16);
  border-top: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
}

.progress-bar__position {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  margin: 0 0 0 var(--space-2);
  white-space: nowrap;
}

.progress-bar__row {
  font: var(--type-control);
  color: var(--ink);
}

.progress-bar__of {
  font: var(--type-meta);
  color: var(--box-muted);
  text-transform: lowercase;
}

.progress-bar__compact-position {
  margin: 0 0 0 var(--space-2);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

/* The wide row count stays out of the bar: the short counter stands in for it at every width (ticket 188, 295; ADR 0046). */
.progress-bar__phone-hide {
  display: none;
}

/* Row not done and Row done (ticket 411): large text buttons, set well apart from Turn row direction beside the switch. */
.progress-bar__steps {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

/* Rows running down the columns point the arrows along them: the down arrow turns to point right, the up arrow left. */
.progress-bar__steps--columns :deep(svg) {
  transform: rotate(-90deg);
}

.progress-bar__track {
  flex: 1 1 auto;
  min-width: var(--space-32);
  height: var(--track-height);
  overflow: hidden;
  background: var(--track);
  border-radius: var(--radius-full);
}

.progress-bar__fill {
  display: block;
  height: 100%;
  background: var(--track-fill);
  border-radius: inherit;
  transition: width var(--duration-base) var(--ease-standard);
}

.progress-bar__off-label {
  font: var(--type-label);
  color: var(--box-muted);
  text-transform: lowercase;
}

/*
 * Phone widths (ticket 411): the large text buttons can't share one row with the switch, Turn row direction and the track
 * at 360px in every language, so the buttons take a second row of their own, half the bar each. The bar is taller there:
 * --progress-height says so (controls.css), and everything that sits above the bar follows it.
 */
@media (max-width: 30rem) {
  .progress-bar {
    flex-wrap: wrap;
    align-content: center;
    gap: var(--space-8) var(--space-12);
  }

  .progress-bar__track {
    min-width: var(--space-32);
  }

  .progress-bar__steps {
    flex: 1 1 100%;
    min-width: 0;
  }

  /* A button is wrapped (for its Tooltip) only while it has one, so a lone button is a flex item too. */
  .progress-bar__steps > .app-button,
  .progress-bar__steps :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .progress-bar__steps :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-8);
    justify-content: center;
    font: var(--type-small);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar__fill {
    transition: none;
  }
}
</style>
