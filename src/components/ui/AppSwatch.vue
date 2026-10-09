<script setup lang="ts">
import { computed, ref } from 'vue'
import { useResolvedTheme } from '../../theme/useResolvedTheme'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import { markOn } from './swatchMark'

/**
 * One color chip (ticket 333; PaletteSwatches card), for the Palette, the Image colors popover and the Canvas color
 * popover. Its Tooltip is the name "Color", the hex as the body and, where it has one, the key chip. `label` is the
 * accessible name (the color's name and position); attributes (`data-*`, `tabindex`, `@keydown`) go to the button.
 *
 * The remove × (added colors only): shown on the active swatch and while a mouse or an Apple Pencil hovers any added
 * swatch (not on touch, which cannot hover) and while keyboard focus is on it. Top-right inside the swatch with no background, drawn in `ink` or
 * `canvas`, whichever reads better on this hex, in a 24px invisible hit area (WCAG 2.5.8).
 */
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
    /** Asks for the ×; it shows while the swatch is selected, hovered or keyboard-focused. */
    removeLabel?: string
  }>(),
  { selected: false, hotkey: undefined, role: 'button', removeLabel: undefined },
)
const emit = defineEmits<{
  select: []
  remove: []
}>()

const { t } = useI18n()
const theme = useResolvedTheme()
const rootEl = ref<HTMLElement>()
/** A mouse or pen is over the swatch (a touch has no hover, so it never sets this). */
const hovered = ref(false)
/** Keyboard focus is on the swatch (or its ×): a click that merely focuses the button doesn't count. */
const focused = ref(false)
const setFocus = (event: FocusEvent, within: boolean) => {
  if (!within) focused.value = !!rootEl.value?.contains(event.relatedTarget as Node | null)
  else focused.value = (event.target as HTMLElement).matches(':focus-visible')
}
const setHover = (event: PointerEvent, over: boolean) => {
  if (event.pointerType !== 'touch') hovered.value = over
}

/** The mark's token, read from the stylesheet so it follows the theme; a bare DOM (a test, no stylesheet) falls back to `ink`. */
const mark = computed(() => {
  void theme.value
  const style = rootEl.value ? getComputedStyle(rootEl.value) : undefined
  const ink = style?.getPropertyValue('--ink').trim()
  const canvas = style?.getPropertyValue('--canvas').trim()
  return ink && canvas ? markOn(props.color, ink, canvas) : 'ink'
})
const showRemove = computed(() => (props.selected || hovered.value || focused.value) && !!props.removeLabel)
</script>

<template>
  <span ref="rootEl" class="swatch" @pointerenter="setHover($event, true)" @pointerleave="setHover($event, false)" @focusin="setFocus($event, true)" @focusout="setFocus($event, false)">
    <AppTooltip :name="t.palette.colorLabel" :body="color" :hotkey="hotkey" :announce="!label.includes(color)">
      <template #default="{ describedby }">
        <button
          v-bind="$attrs"
          type="button"
          class="swatch__chip"
          :class="{ 'swatch__chip--selected': selected }"
          :style="{ backgroundColor: color }"
          :role="role === 'radio' ? 'radio' : undefined"
          :aria-label="label"
          :aria-pressed="role === 'button' ? selected : undefined"
          :aria-checked="role === 'radio' ? selected : undefined"
          :aria-describedby="describedby"
          @click="emit('select')"
        >
          <slot />
        </button>
      </template>
    </AppTooltip>
    <button
      v-if="showRemove"
      type="button"
      class="swatch__remove"
      :class="`swatch__remove--${mark}`"
      :aria-label="removeLabel"
      tabindex="-1"
      data-testid="palette-swatch-remove"
      @click="emit('remove')"
    >
      <AppIcon class="swatch__remove-icon" name="close" :size="14" />
    </button>
  </span>
</template>

<style scoped>
/* The chip's size is the parent's to set: `--swatch-size` (the whole cell by default); `--swatch-min` a floor for touch (ticket 166); `--swatch-gap` is the color the
 * selected ring's gap is drawn in, the surface the swatch sits on. */
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

/* A 24×24 button with no look of its own: only the 10px × shows. */
.swatch__remove {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  width: var(--hit-min);
  height: var(--hit-min);
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
}

.swatch__remove--ink {
  color: var(--ink);
}

.swatch__remove--canvas {
  color: var(--canvas);
}

.swatch__remove-icon {
  width: var(--swatch-remove-size);
  height: var(--swatch-remove-size);
}

.swatch__remove:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: calc(-1 * var(--focus-offset));
}

@media (prefers-reduced-motion: reduce) {
  .swatch__chip:active {
    transform: none;
  }
}
</style>
