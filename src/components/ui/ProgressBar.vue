<script setup lang="ts">
import { computed } from 'vue'
import { rowProgressPosition, type Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import AppButton from './AppButton.vue'
import AppSwitch from './AppSwitch.vue'
import IconButton from './IconButton.vue'

/**
 * Progress bar (CONTEXT.md; ticket 144, ProgressBar card): every Row progress control, in one 56px bar along the canvas
 * box's bottom edge, always shown whatever the Project's shape. The switch that turns Row progress on comes first, so
 * the bar has to be there while it is off: then only the switch and its label show, and the bar keeps its height so the
 * canvas doesn't jump. On, it reads out the current row, shows the finished share, and holds Turn row direction, Row
 * not done and Row done, which move the current-row pointer exactly as the hotkeys do (D, Shift+Enter/Shift+Space,
 * Enter/Space (ticket 178); P toggles the switch).
 */
const props = defineProps<{ project: Project }>()

const emit = defineEmits<{
  'move-row': [delta: number]
  'toggle-row-progress': [enabled: boolean]
  'toggle-row-direction': []
  /** The bar's own way to Set Frame, shown while there is no Frame to count rows on. */
  'set-frame': []
}>()

const { t } = useI18n()

const enabled = computed({
  get: () => props.project.rowProgress.enabled && props.project.frame !== undefined,
  set: (on: boolean) => emit('toggle-row-progress', on),
})

/** Row progress works on the Frame's rows, so with no Frame the bar can only ask for one. */
const hasFrame = computed(() => props.project.frame !== undefined)

const position = computed(() => rowProgressPosition(props.project))

/** Rows before the current one are finished. */
const finishedShare = computed(() => (position.value.total > 0 ? position.value.current / position.value.total : 0))

const directionLabel = computed(() =>
  props.project.rowProgress.direction === 'rows' ? t.value.rowProgress.topToBottom : t.value.rowProgress.leftToRight,
)
</script>

<template>
  <div class="progress-bar" :class="{ 'progress-bar--off': !enabled }" data-testid="progress-bar">
    <AppSwitch v-model="enabled" :label="t.rowProgress.enabledLabel" :disabled="!hasFrame" data-testid="progress-bar-switch" data-tour="progress-switch" />

    <template v-if="!hasFrame">
      <span class="progress-bar__row">{{ t.toolbox.groups.rowProgress }}</span>
      <span class="progress-bar__need" data-testid="progress-bar-needs-frame">{{ t.frame.progressNeedsFrame }}</span>
      <AppButton class="progress-bar__set-frame" variant="box" icon="frame" data-testid="progress-bar-set-frame" @click="emit('set-frame')">
        {{ t.frame.setFrame }}
      </AppButton>
    </template>
    <template v-else-if="enabled">
      <p class="progress-bar__position progress-bar__phone-hide" data-testid="progress-bar-position">
        <span class="progress-bar__row">{{ t.rowProgress.positionLabel }} {{ position.current + 1 }}</span>
        {{ ' ' }}
        <span class="progress-bar__of">{{
          t.rowProgress.ofTotal.replace('{total}', String(position.total)).replace('{direction}', directionLabel)
        }}</span>
      </p>
      <!-- The phone tier's compact mode (ticket 188): "1/222" in place of the spelled-out row count, and Row not
        done/Row done as icon-only buttons with a hover/focus label instead of the reference tier's wide text ones --
        the bar is the widest control on the phone screen already (responsive.md), so it can't also spell everything out. -->
      <p class="progress-bar__compact-position progress-bar__phone-only" data-testid="progress-bar-compact-position">
        {{ position.current + 1 }}/{{ position.total }}
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
      <IconButton tooltip
        icon="turn-row-direction"
        variant="box"
        :label="t.rowProgress.directionButton"
        :selected="project.rowProgress.direction === 'columns'"
        data-testid="progress-bar-direction"
        @click="emit('toggle-row-direction')"
      />
      <AppButton
        class="progress-bar__phone-hide"
        variant="box"
        icon="chevron-left"
        data-testid="progress-bar-previous"
        data-tour="progress-previous"
        :title="`${t.rowProgress.previousButton} (Shift+Enter, Shift+Space)`"
        :disabled="position.current === 0"
        @click="emit('move-row', -1)"
      >
        {{ t.rowProgress.previousButton }}
      </AppButton>
      <IconButton tooltip
        class="progress-bar__phone-only"
        variant="box"
        icon="chevron-left"
        :label="t.rowProgress.previousButton"
        data-testid="progress-bar-previous-compact"
        data-tour="progress-previous"
        :disabled="position.current === 0"
        @click="emit('move-row', -1)"
      />
      <AppButton
        class="progress-bar__phone-hide"
        variant="primary"
        icon="check"
        data-testid="progress-bar-next"
        data-tour="progress-next"
        :title="`${t.rowProgress.nextButton} (Enter, Space)`"
        :disabled="position.current === position.total - 1"
        @click="emit('move-row', 1)"
      >
        {{ t.rowProgress.nextButton }}
      </AppButton>
      <IconButton tooltip
        class="progress-bar__phone-only"
        variant="box"
        icon="check"
        :label="t.rowProgress.nextButton"
        data-testid="progress-bar-next-compact"
        data-tour="progress-next"
        :disabled="position.current === position.total - 1"
        @click="emit('move-row', 1)"
      />
    </template>
    <span v-else class="progress-bar__off-label">{{ t.toolbox.groups.rowProgress }}</span>
  </div>
</template>

<style scoped>
/* No Frame (ProgressBar card): "Set Frame to start" in `meta`, and the Set Frame button pushed to the right. */
.progress-bar__need {
  font: var(--type-meta);
  color: var(--box-muted);
  white-space: nowrap;
}

.progress-bar__set-frame {
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

/* The phone layout's compact mode (ticket 188, 295: under 1024px): swaps the spelled-out row count and text row buttons for a short
   counter and icon-only ones, same rule as the header's own app-header__phone-only/-hide. */
.progress-bar__phone-only {
  display: none;
}

@media (max-width: 1023px) {
  .progress-bar__phone-hide {
    display: none;
  }

  .progress-bar__phone-only {
    display: inline-flex;
  }
}

/* The same compact mode wherever the bar itself is too narrow for the spelled-out one, e.g. beside the Tour card or
   the Toolbox at tablet widths (ticket 246). */
@container (max-width: 51rem) {
  .progress-bar__phone-hide {
    display: none;
  }

  .progress-bar__phone-only {
    display: inline-flex;
  }
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

@media (prefers-reduced-motion: reduce) {
  .progress-bar__fill {
    transition: none;
  }
}
</style>
