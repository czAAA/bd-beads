<script setup lang="ts">
import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import {
  fittedCount,
  MAX_GRID_FOLD,
  MIN_FOLD,
  MIRROR_AXES,
  MIRROR_MODES,
  withAxisToggled,
  withMirrorCount,
  withMirrorFold,
  withMirrorMode,
  type MirrorAxis,
  type MirrorFit,
  type MirrorMode,
  type MirrorSetting,
  type ShapeAxes,
} from '../../domain/mirror'
import { useI18n } from '../../i18n/useI18n'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import type { IconName } from '../ui/icons'

// The Mirror bar's items (ADR 0082, ticket 0750; ContextBar card, Mirror bar), drawn inside the ContextBar's own bar
// after its size readout: the Mode, the Axis chips with their Steppers (or a Custom frame's note), Close mirror. Every
// control carries `context-bar__control`, so the bar's arrows walk them (ADR 0075).
const props = defineProps<{
  setting: MirrorSetting
  /** What the Area offers (ticket 0775): each direction's Axis counts and Radial's Folds, none with the reason where a
   * chip is off. Without it every count and both Folds are offered. */
  fit?: MirrorFit
  /** A Custom frame's own Axes while the whole Frame is the Mirror: noted, with no chips. */
  shape?: ShapeAxes
  iconSize: 16 | 18
}>()

const emit = defineEmits<{
  'update:setting': [setting: MirrorSetting]
  close: []
}>()

const { t } = useI18n()

const AXIS_ICONS: Record<MirrorAxis, IconName> = { leftRight: 'axis-left-right', topBottom: 'axis-top-bottom', radial: 'axis-centre' }
const axisName = (axis: MirrorAxis) => t.value.mirror[axis]
const modeName = (mode: MirrorMode) => t.value.mirror[mode]

/** Why a chip is off (ContextBar card): the Area is one bead across its direction, or peyote's or brick's half-bead
 * shift has no exact image there (ticket 0775); none for one that can be on. */
const offReason = (axis: MirrorAxis) => {
  const reason = props.fit?.off[axis]
  if (!reason) return undefined
  if (axis === 'radial') return t.value.mirror.shiftRadial
  if (reason === 'oneBead') return axis === 'leftRight' ? t.value.mirror.oneBeadWide : t.value.mirror.oneBeadTall
  return axis === 'leftRight' ? t.value.mirror.shiftWide : t.value.mirror.shiftTall
}
const isOn = (axis: MirrorAxis) => props.setting.axes[axis] && !offReason(axis)

/** Why Radial's + is off: a quarter turn needs a square Area (ticket 0751) with no half-bead shift (ticket 0775). */
const quarterReason = computed(() => {
  const off = props.fit?.quarterOff
  return off === 'square' ? t.value.mirror.quarterNeedsSquare : off === 'shift' ? t.value.mirror.quarterNeedsStraight : undefined
})

/** The values a chip's Stepper steps through, ascending: an Axis count the Area offers, or Radial's Fold, 2 or 4. */
function valuesOf(axis: MirrorAxis): readonly number[] | undefined {
  if (axis === 'radial') return props.fit?.folds ?? [MIN_FOLD, MAX_GRID_FOLD]
  return props.fit?.counts[axis]
}

/** The Stepper a chip that is on carries: its value as the Mirror uses it, and the values either side of it. */
function stepperFor(axis: MirrorAxis) {
  const values = valuesOf(axis)
  const names = axis === 'radial'
    ? { fewer: t.value.mirror.fewerFolds, more: t.value.mirror.moreFolds, name: t.value.mirror.fold }
    : { fewer: t.value.mirror.fewerAxes, more: t.value.mirror.moreAxes, name: axis === 'leftRight' ? t.value.mirror.leftRightAxes : t.value.mirror.topBottomAxes }
  const wanted = axis === 'radial' ? props.setting.fold : props.setting.counts[axis]
  const fitted = axis === 'radial' ? (values?.length ? Math.min(wanted, Math.max(...values)) : undefined) : props.fit && fittedCount(props.fit, axis, wanted)
  const value = fitted ?? wanted
  // Without a fit an Axis count steps one at a time, with no top.
  const below = values ? [...values].reverse().find((each) => each < value) : value > 1 ? value - 1 : undefined
  const above = values ? values.find((each) => each > value) : value + 1
  return { value, below, above, ...names }
}

const steppers = computed(() => Object.fromEntries(MIRROR_AXES.map((axis) => [axis, stepperFor(axis)])) as Record<MirrorAxis, ReturnType<typeof stepperFor>>)
const stepperOf = (axis: MirrorAxis) => steppers.value[axis]

/** A Custom frame's note in place of the chips (ContextBar card): its Radial and side count, or its one straight line,
 * which Repeat cannot use. */
const shapeNote = computed(() => {
  const shape = props.shape
  if (!shape) return undefined
  if (shape.axes.radial) return fillBlanks(t.value.mirror.radialFromShape, { count: shape.sides ?? MIN_FOLD })
  const axis = axisName(shape.axes.leftRight ? 'leftRight' : 'topBottom')
  return fillBlanks(props.setting.mode === 'repeat' ? t.value.mirror.repeatNeedsRadial : t.value.mirror.lineFromShape, { axis })
})

const setMode = (mode: MirrorMode) => emit('update:setting', withMirrorMode(props.setting, mode))
function toggle(axis: MirrorAxis) {
  if (!offReason(axis)) emit('update:setting', withAxisToggled(props.setting, axis))
}
function step(axis: MirrorAxis, by: number) {
  // The next value the Area offers: a Fold steps between 2 and 4 (ticket 0751), a count on peyote and brick skips the
  // ones the half-bead shift has no exact image for (ticket 0775).
  const { below, above } = stepperOf(axis)
  const next = by < 0 ? below : above
  if (next === undefined) return
  emit('update:setting', axis === 'radial' ? withMirrorFold(props.setting, next) : withMirrorCount(props.setting, axis, next))
}
</script>

<template>
  <!-- One root, so the bar can hide the items while it shows its size alone; `display: contents` keeps each a flex item
    of the bar. -->
  <div class="mirror-bar__items">
    <span class="context-bar__divider" aria-hidden="true" />
    <div class="mirror-bar__mode" role="radiogroup" :aria-label="t.mirror.mode" data-testid="mirror-bar-mode">
      <button
        v-for="mode in MIRROR_MODES"
        :key="mode"
        type="button"
        role="radio"
        class="context-bar__control mirror-bar__segment"
        :aria-checked="setting.mode === mode"
        :data-testid="`mirror-bar-mode-${mode}`"
        @click="setMode(mode)"
      >
        {{ modeName(mode) }}
      </button>
    </div>
    <span class="context-bar__divider mirror-bar__chips-divider" aria-hidden="true" />
    <span v-if="shapeNote" class="mirror-bar__note" data-testid="mirror-bar-shape-note">{{ shapeNote }}</span>
    <div v-else class="mirror-bar__chips" role="group" :aria-label="t.mirror.title" data-testid="mirror-bar-chips">
      <span
        v-for="axis in MIRROR_AXES"
        :key="axis"
        class="mirror-bar__chip"
        :class="{ 'mirror-bar__chip--on': isOn(axis), 'mirror-bar__chip--off': !!offReason(axis) }"
        :data-testid="`mirror-bar-chip-${axis}`"
      >
        <IconButton
          variant="plain"
          class="context-bar__control mirror-bar__chip-button"
          :icon="AXIS_ICONS[axis]"
          :icon-size="iconSize"
          :label="axisName(axis)"
          :pressed="isOn(axis)"
          :disabled="offReason(axis) ? true : undefined"
          :disabled-body="offReason(axis)"
          tooltip
          :data-testid="`mirror-bar-axis-${axis}`"
          @click="toggle(axis)"
        />
        <span v-if="isOn(axis)" class="mirror-bar__count">
          <AppTooltip :name="stepperOf(axis).fewer" :announce="false" :disabled="stepperOf(axis).below === undefined">
            <button
              type="button"
              class="context-bar__control mirror-bar__step"
              :aria-label="stepperOf(axis).fewer"
              :aria-disabled="stepperOf(axis).below === undefined ? 'true' : undefined"
              :data-testid="`mirror-bar-${axis}-fewer`"
              @click="step(axis, -1)"
            >
              −
            </button>
          </AppTooltip>
          <output class="mirror-bar__value" :aria-label="`${stepperOf(axis).name}, ${stepperOf(axis).value}`" :data-testid="`mirror-bar-${axis}-value`">{{ stepperOf(axis).value }}</output>
          <AppTooltip :name="stepperOf(axis).more" :announce="false" :disabled="stepperOf(axis).above === undefined" :disabled-body="axis === 'radial' ? quarterReason : undefined">
            <button
              type="button"
              class="context-bar__control mirror-bar__step"
              :aria-label="stepperOf(axis).more"
              :aria-disabled="stepperOf(axis).above === undefined ? 'true' : undefined"
              :data-testid="`mirror-bar-${axis}-more`"
              @click="step(axis, 1)"
            >
              +
            </button>
          </AppTooltip>
        </span>
      </span>
    </div>
    <span class="context-bar__divider mirror-bar__close-divider" aria-hidden="true" />
    <IconButton
      variant="plain"
      class="context-bar__control context-bar__button mirror-bar__close"
      icon="close"
      :icon-size="iconSize"
      :label="t.mirror.closeMirror"
      tooltip
      data-testid="mirror-bar-close"
      @click="emit('close')"
    />
  </div>
</template>

<style scoped>
.mirror-bar__items {
  display: contents;
}

/* The Mode switch (ContextBar card, Mirror bar): two segments in a 1px `canvas` 30% border, the chosen one filled
 * `canvas` with its text `ink` at 600. Hover, press, focus and the filled look are the bar's, shared with the Selection
 * bar's buttons (ContextBar.vue). */
.mirror-bar__mode {
  display: inline-flex;
  flex: none;
  gap: 1px;
  box-sizing: border-box;
  height: var(--mirror-bar-control);
  padding: 1px;
  border: 1px solid color-mix(in srgb, var(--canvas) 30%, transparent);
  border-radius: var(--radius-sm);
}

.mirror-bar__segment {
  padding: 0 var(--space-8);
  font: var(--type-small);
  color: color-mix(in srgb, var(--canvas) 74%, transparent);
  white-space: nowrap;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-xs);
}

.mirror-bar__segment[aria-checked='true'] {
  font-weight: 600;
}

.mirror-bar__chips {
  display: flex;
  flex: none;
  gap: 3px;
  align-items: center;
}

/* An Axis chip: an icon cell in a 1px `canvas` 30% border; on, the border `canvas` and the cell filled `canvas` with
 * its icon `ink`, its Stepper attached inside the border. */
.mirror-bar__chip {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--mirror-bar-control);
  color: color-mix(in srgb, var(--canvas) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--canvas) 30%, transparent);
  border-radius: var(--radius-sm);
}

.mirror-bar__chip--on {
  border-color: var(--canvas);
}

.mirror-bar__chip :deep(.mirror-bar__chip-button) {
  display: grid;
  place-items: center;
  width: calc(var(--mirror-bar-control) - 2px);
  min-width: 0;
  height: calc(var(--mirror-bar-control) - 2px);
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-xs);
}

.mirror-bar__chip--off :deep(.mirror-bar__chip-button) {
  opacity: 0.38;
}

.mirror-bar__count {
  display: inline-flex;
  align-items: center;
}

.mirror-bar__step {
  display: grid;
  place-items: center;
  width: var(--mirror-bar-control);
  height: calc(var(--mirror-bar-control) - 2px);
  padding: 0;
  font: var(--type-meta-small);
  color: var(--canvas);
  cursor: pointer;
  background: none;
  border: 0;
}

.mirror-bar__step[aria-disabled='true'] {
  cursor: default;
  opacity: 0.38;
}

.mirror-bar__value {
  min-width: var(--space-14);
  font: var(--type-meta-small);
  font-weight: 500;
  color: var(--canvas);
  text-align: center;
}

.mirror-bar__note {
  flex: none;
  padding: 0 var(--space-6);
  font: var(--type-meta);
  color: color-mix(in srgb, var(--canvas) 74%, transparent);
  white-space: nowrap;
}

@media (pointer: coarse) {
  .mirror-bar__mode,
  .mirror-bar__chip {
    height: var(--mirror-bar-control-touch);
  }

  .mirror-bar__chip :deep(.mirror-bar__chip-button) {
    width: calc(var(--mirror-bar-control-touch) - 2px);
    height: calc(var(--mirror-bar-control-touch) - 2px);
  }

  .mirror-bar__step {
    width: var(--mirror-bar-control-touch);
    height: calc(var(--mirror-bar-control-touch) - 2px);
  }
}
</style>
