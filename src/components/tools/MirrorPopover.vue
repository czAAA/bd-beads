<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { usePillPopoverPlacement } from '../../composables/tools/usePillPopoverPlacement'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { isMirrorOn, MIRROR_DIRECTIONS, MIRROR_MODES, withAxisToggled, withMirrorCount, withMirrorMode, type MirrorDirection, type MirrorMode, type MirrorSetting } from '../../domain/mirror'
import type { PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import IconButton from '../ui/IconButton.vue'

// The Mirror popover (ADR 0082, spec 0702, ticket 0703; MirrorPopover card): the Mirror tile's popover, the colour
// popover's box beside the pill. Its rows are sections of their own, so Radial and the Fold (ticket 0705) and the Area
// (ticket 0710) slot in: the Mode, the Axes, then the details that apply (the Frame's Axis count Steppers).
const props = defineProps<{
  /** The Mirror tile that opened it, and the pill it is part of: where the popover is placed. */
  tile: HTMLElement | undefined
  pill: HTMLElement | undefined
  position: PillPosition
  setting: MirrorSetting
  /** Each direction's Axis count limit, the Frame's beads minus one; none without a Frame on a grid, where the count
   * Steppers are not shown. */
  limits?: Record<MirrorDirection, number>
}>()

const emit = defineEmits<{
  close: []
  'update:setting': [setting: MirrorSetting]
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
const closeAction = controlAction('close')
const modeId = useId()
const axesId = useId()

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => emit('close'),
  isOpener: (target) => props.tile?.contains(target) ?? false,
})
const style = usePillPopoverPlacement(rootEl, () => ({ tile: props.tile, pill: props.pill, position: props.position }))

const modeWords: Record<MirrorMode, () => string> = { off: () => t.value.mirror.off, mirror: () => t.value.mirror.mirror, repeat: () => t.value.mirror.repeat }
const modeOptions = computed(() => MIRROR_MODES.map((value) => ({ value, label: modeWords[value]() })))
const directionWords: Record<MirrorDirection, { chip: () => string; count: () => string }> = {
  leftRight: { chip: () => t.value.mirror.leftRight, count: () => t.value.mirror.leftRightAxes },
  topBottom: { chip: () => t.value.mirror.topBottom, count: () => t.value.mirror.topBottomAxes },
}
const anyAxis = computed(() => MIRROR_DIRECTIONS.some((direction) => props.setting.axes[direction]) || props.setting.axes.radial)
/** The directions whose Axis count Stepper shows: a Frame on a grid, and that Axis on. */
const counted = computed(() => (props.limits ? MIRROR_DIRECTIONS.filter((direction) => props.setting.axes[direction]) : []))
/** A count above the Frame's limit is shown clamped, as it acts (spec 0702). */
const countOf = (direction: MirrorDirection) => Math.min(props.setting.counts[direction], props.limits?.[direction] ?? Infinity)

const setMode = (mode: MirrorMode) => emit('update:setting', withMirrorMode(props.setting, mode))
const toggleAxis = (direction: MirrorDirection) => emit('update:setting', withAxisToggled(props.setting, direction))
const setCount = (direction: MirrorDirection, count: number) => emit('update:setting', withMirrorCount(props.setting, direction, count))
</script>

<template>
  <div ref="rootEl" class="mirror-popover" :style="style" role="dialog" :aria-label="t.mirror.title" data-testid="mirror-popover">
    <div class="mirror-popover__head">
      <span class="mirror-popover__title">{{ t.mirror.title }}</span>
      <IconButton class="mirror-popover__close" variant="plain" :action="closeAction" :label="t.mirror.close" :icon-size="16" data-testid="mirror-popover-close" @click="emit('close')" />
    </div>

    <section class="mirror-popover__row" data-testid="mirror-mode-row">
      <span :id="modeId" class="mirror-popover__label">{{ t.mirror.mode }}</span>
      <SegmentedControl :model-value="setting.mode" :options="modeOptions" :labelledby="modeId" small @update:model-value="setMode" />
    </section>

    <section class="mirror-popover__row" data-testid="mirror-axes-row">
      <span :id="axesId" class="mirror-popover__label">{{ t.mirror.axes }}</span>
      <div class="mirror-popover__chips" role="group" :aria-labelledby="axesId">
        <button
          v-for="direction in MIRROR_DIRECTIONS"
          :key="direction"
          type="button"
          class="ui-control mirror-popover__chip"
          :aria-pressed="setting.axes[direction]"
          :data-testid="`mirror-axis-${direction}`"
          @click="toggleAxis(direction)"
        >
          {{ directionWords[direction].chip() }}
        </button>
      </div>
    </section>

    <section v-for="direction in counted" :key="direction" class="mirror-popover__row" :data-testid="`mirror-count-${direction}`">
      <span class="mirror-popover__label">{{ directionWords[direction].count() }}</span>
      <AppStepper
        :model-value="countOf(direction)"
        :min="1"
        :max="limits![direction]"
        :decrease-label="t.mirror.fewerAxes"
        :value-label="directionWords[direction].count()"
        :increase-label="t.mirror.moreAxes"
        tooltip
        :decrease-testid="`mirror-count-${direction}-fewer`"
        :increase-testid="`mirror-count-${direction}-more`"
        :value-testid="`mirror-count-${direction}-value`"
        @update:model-value="setCount(direction, $event)"
      />
    </section>

    <AppNote v-if="isMirrorOn(setting) && !anyAxis" data-testid="mirror-no-axis-note">{{ t.mirror.turnAxisOn }}</AppNote>
  </div>
</template>

<style scoped>
/* The colour popover's box (ToolPill card, MirrorPopover card): 288px, --pill-popover-radius corners, overlay fill and
 * line, elevation-3, padding 12px 14px 14px, 12px between rows. */
.mirror-popover {
  position: fixed;
  z-index: var(--z-popover);
  /* It lives in the pill's layer, which takes no pointer events; the popover takes its own. */
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  box-sizing: border-box;
  width: var(--popover-width);
  max-height: calc(100dvh - 2 * var(--float-edge));
  padding: var(--space-12) var(--space-14) var(--space-14);
  overflow-y: auto;
  overscroll-behavior: none;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--pill-popover-radius);
  box-shadow: var(--elevation-3);
  animation: mirror-popover-in var(--duration-slow) var(--ease-out);
}

@keyframes mirror-popover-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mirror-popover {
    animation: none;
  }
}

.mirror-popover__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.mirror-popover__title {
  font: var(--type-control);
  color: var(--ink);
}

.mirror-popover__close {
  flex: none;
  margin-left: auto;
}

.mirror-popover__row {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.mirror-popover__label {
  font: var(--type-meta-small);
  color: var(--muted);
}

.mirror-popover__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

/* An Axis chip (MirrorPopover card): 32px tall, pill-shaped, `button` fill with its line; pressed, the `panel` fill
 * with the strong accent as border and text. */
.mirror-popover__chip {
  box-sizing: border-box;
  height: var(--mirror-chip-height);
  padding: 0 var(--space-12);
  font: var(--type-control);
  color: var(--ink);
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-full);
  cursor: pointer;
}

@media (hover: hover) {
  .mirror-popover__chip:hover {
    background: var(--hover-fill);
  }
}

.mirror-popover__chip[aria-pressed='true'] {
  font-weight: 600;
  color: var(--accent-strong);
  background: var(--panel);
  border-color: var(--accent-strong);
}

.mirror-popover__chip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
</style>
