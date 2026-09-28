<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { estimatedSizeMm, formatSizeMm } from '../domain/patternSize'
import { resolvePatternBead, type Pattern } from '../domain/pattern'
import { useI18n } from '../i18n/useI18n'

/**
 * The body of the Size Tool group (CONTEXT.md's Estimated size and Resize, ADR 0017): the open Pattern's Estimated
 * size with its warning tooltip, and the button that opens Change size (ticket 172 removed the old stepper controls
 * — every size or unit change now goes through that modal's own confirmation).
 */
const props = defineProps<{ pattern: Pattern }>()

const emit = defineEmits<{
  /** Asks App to open the Change size modal (ticket 153). */
  'change-size': []
}>()

const { t, locale } = useI18n()

const locked = computed(() => props.pattern.rowProgress.enabled)
const bead = computed(() => resolvePatternBead(props.pattern))
const unitLabels = computed(() => ({ mm: t.value.form.unitMm, cm: t.value.form.unitCm }))

const estimate = computed(() => {
  if (!bead.value) {
    return undefined
  }
  return formatSizeMm(
    estimatedSizeMm({ columns: props.pattern.columns, rows: props.pattern.rows, rotation: props.pattern.rotation }, bead.value),
    unitLabels.value,
    locale.value,
  )
})

const lockedNoteId = useId()
const tooltipId = useId()
const tipOpen = ref(false)
</script>

<template>
  <div class="size-controls" data-testid="size-controls">
    <div v-if="estimate" class="size-controls__estimate" data-testid="size-estimate-row">
      <span
        class="size-controls__estimate-text"
        role="group"
        :aria-label="t.size.estimateLabel"
        data-testid="size-estimate"
      >
        ≈ {{ estimate }}
      </span>
      <!-- data-skip-autofocus (ticket 188): the first focusable thing here, so a sheet/drawer that opens on top of
        this row would otherwise land its opening focus here and pop the tooltip uninvited (its own @focus handler
        is correct -- Tab still reaches and opens it -- BottomSheet/AppDrawer's initial focus is what needs to skip it). -->
      <button
        type="button"
        class="size-controls__info"
        data-testid="size-estimate-info"
        data-skip-autofocus
        :aria-label="t.size.estimateInfoButton"
        :aria-describedby="tooltipId"
        @mouseenter="tipOpen = true"
        @mouseleave="tipOpen = false"
        @focus="tipOpen = true"
        @blur="tipOpen = false"
        @keydown.escape="tipOpen = false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <path d="M12 7.5v.01" />
        </svg>
      </button>
      <span
        v-show="tipOpen"
        :id="tooltipId"
        class="size-controls__tooltip"
        role="tooltip"
        data-testid="size-estimate-tooltip"
      >
        {{ t.size.estimateWarning }}
      </span>
    </div>

    <!--
      Kept focusable while Row progress is on (aria-disabled, not disabled) so the reason can be reached from the
      keyboard too: it is on the button's title and read out as its description, and shown below.
    -->
    <button
      type="button"
      class="size-controls__change"
      data-testid="size-change-size"
      :aria-disabled="locked"
      :aria-describedby="locked ? lockedNoteId : undefined"
      :title="locked ? t.size.lockedReason : undefined"
      @click="locked || emit('change-size')"
    >
      {{ t.changeSize.button }}
    </button>
    <p v-if="locked" :id="lockedNoteId" class="size-controls__note" data-testid="size-change-size-locked">
      {{ t.size.lockedReason }}
    </p>
  </div>
</template>

<style scoped>
/*
 * As wide as the Tool group it sits in (a full row of ToolGroup's fixed columns — ticket 114 made the Toolbox a narrow
 * rail), so everything below wraps inside that width rather than setting one of its own: the estimate and the notes
 * wrap, and each row's counter and "change from" choice fall onto as many lines as they need.
 */
.size-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.size-controls__estimate {
  /* A full-width row of the block above, so the tooltip anchored to it is as wide as the rail, not as wide as "≈ 1.5 × 3.0 cm". */
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.size-controls__estimate-text {
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* A small glyph, not a full icon-button: it sits in a line of text and carries the tooltip, nothing else. */
.size-controls__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--ink);
  background: var(--warning);
  border: 0;
  border-radius: var(--radius-full);
}

.size-controls__info:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.size-controls__info svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The warning color, not an error's: this is a guide, not a fact. Opens below the estimate at the rail's width, over the controls under it — within the rail, since the rail scrolls and would clip anything wider. */
.size-controls__tooltip {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  box-sizing: border-box;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ink);
  background: var(--warning);
  border: 1px solid var(--ink);
  border-radius: var(--radius-md);
}

/*
 * The design system's `toolbox` AppButton look, hand-drawn: this button stays reachable while Row progress locks it
 * (aria-disabled, not disabled), which AppButton's own `disabled` prop can't do (BeadQuantities and the reason under
 * it need it focusable).
 */
.size-controls__change {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  height: var(--control-height);
  padding: 0 var(--space-12);
  box-sizing: border-box;
  font: var(--type-control);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

:root[data-theme='dark'] .size-controls__change {
  border-color: var(--elevated);
}

@media (hover: hover) {
  .size-controls__change:hover[aria-disabled='false'] {
    background: var(--elevated);
    border-color: var(--ink);
  }
}

.size-controls__change:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.size-controls__change[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-controls__note {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  opacity: 0.75;
}

.size-controls__note--error {
  color: var(--danger);
  font-weight: 700;
  opacity: 1;
}
</style>
