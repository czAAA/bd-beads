<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import { markOn } from './swatchMark'

// One color chip (ticket 333; PaletteSwatches card). Tooltip: name, hex body, key chip if any. `label` is the a11y
// name. In Edit palette (ticket 531) an added swatch shows a centered × (a picture, the whole chip is the press) and a
// built-in one fades and says why it cannot be removed.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    color: string
    label: string
    selected?: boolean
    /** The Tooltip's key chip, e.g. `Shift+1`. */
    hotkey?: string
    /** How the swatch is exposed: a toggle button (the default) or a radio of a radiogroup. */
    role?: 'button' | 'radio'
    /** Edit palette, an added swatch: a press removes it, so it shows the ×. */
    removable?: boolean
    /** Edit palette, a built-in swatch: why it cannot be removed. It fades, is `aria-disabled` and says this. */
    lockedBody?: string
    /** The Tooltip's name in place of "Color", e.g. the margin picker's Canvas color swatch (ticket 0684). */
    tooltipName?: string
  }>(),
  { selected: false, hotkey: undefined, role: 'button', removable: false, lockedBody: undefined, tooltipName: undefined },
)
const emit = defineEmits<{
  select: []
}>()

const { t } = useI18n()

/** The × is black or white by the swatch's own hex, whatever the theme. */
const mark = computed(() => markOn(props.color))
const tooltip = computed(() => {
  const name = props.tooltipName ?? t.value.palette.colorLabel
  return props.lockedBody === undefined
    ? { name, body: props.color, hotkey: props.hotkey, announce: !props.label.includes(props.color) }
    : { name, disabled: true as const, disabledBody: props.lockedBody, announce: true }
})
</script>

<template>
  <span class="swatch" :class="{ 'swatch--locked': lockedBody !== undefined }">
    <AppTooltip v-bind="tooltip">
      <template #default="{ describedby }">
        <button
          v-bind="$attrs"
          type="button"
          class="swatch__chip"
          :class="{ 'swatch__chip--selected': selected }"
          :style="{ backgroundColor: color }"
          :role="role === 'radio' ? 'radio' : undefined"
          :aria-label="label"
          :aria-pressed="role === 'button' && !removable ? selected : undefined"
          :aria-checked="role === 'radio' ? selected : undefined"
          :aria-disabled="lockedBody === undefined ? undefined : 'true'"
          :aria-describedby="describedby"
          @click="emit('select')"
        >
          <slot />
        </button>
      </template>
    </AppTooltip>
    <span v-if="removable" class="swatch__remove" :class="`swatch__remove--${mark}`" aria-hidden="true" data-testid="palette-swatch-remove">
      <AppIcon class="swatch__remove-icon" name="close" :size="14" />
    </span>
  </span>
</template>

<style scoped>
/* The chip's size is the parent's to set: `--swatch-size` (the whole cell by default); `--swatch-min` a floor for
 * touch (ticket 166); `--swatch-gap` is the color the selected ring's gap is drawn in, the surface the swatch sits
 * on. */
.swatch {
  position: relative;
  display: block;
  width: var(--swatch-size, 100%);
}

.swatch :deep(.app-tooltip) {
  display: block;
}

.swatch__chip {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  aspect-ratio: 1;
  width: 100%;
  min-width: var(--swatch-min, 0);
  min-height: var(--swatch-min, 0);
  padding: 0;
  color: var(--ink);
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  cursor: pointer;
  transition: transform var(--duration-instant) var(--ease-standard);
}

.swatch__chip--selected {
  box-shadow:
    inset 0 0 0 1px var(--swatch-edge),
    0 0 0 2px var(--swatch-gap, var(--panel)),
    0 0 0 4px var(--ring);
}

.swatch__chip:active {
  transform: scale(0.93);
}

.swatch__chip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* The × of Edit palette (ticket 531): a picture centered on the chip; the press goes to the chip under it. */
.swatch__remove {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  pointer-events: none;
  animation: swatch-remove-in var(--duration-fast) var(--ease-standard);
}

@keyframes swatch-remove-in {
  from {
    opacity: 0;
  }
}

/* A built-in swatch in Edit palette: faded, but still focusable and draggable. */
.swatch--locked .swatch__chip {
  opacity: var(--swatch-faded-opacity);
}

.swatch__remove--dark {
  --mark: var(--swatch-mark-dark);
  --mark-halo: var(--swatch-mark-light);
}

.swatch__remove--light {
  --mark: var(--swatch-mark-light);
  --mark-halo: var(--swatch-mark-dark);
}

.swatch__remove-icon {
  /* !important: the icon sets its own size inline, in rem, from its `size` prop (14 at least). */
  width: var(--swatch-edit-remove-size) !important;
  height: var(--swatch-edit-remove-size) !important;
  color: var(--mark);
  stroke-width: var(--swatch-edit-remove-stroke);
  filter: drop-shadow(0 0 var(--swatch-mark-halo) var(--mark-halo)) drop-shadow(0 0 var(--swatch-mark-halo) var(--mark-halo));
}

@media (prefers-reduced-motion: reduce) {
  .swatch__chip:active {
    transform: none;
  }

  .swatch__remove {
    animation: none;
  }
}
</style>
