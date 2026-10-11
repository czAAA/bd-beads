<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import { markOn } from './swatchMark'

/**
 * One color chip (ticket 333; PaletteSwatches card), for the Palette, the Image colors popover and the Canvas color
 * popover. Its Tooltip is the name "Color", the hex as the body and, where it has one, the key chip. `label` is the
 * accessible name (the color's name and position); attributes (`data-*`, `tabindex`, `@keydown`) go to the button.
 *
 * The remove × (added colors only): shown on the active swatch, while a mouse or an Apple Pencil hovers an added swatch
 * (touch cannot hover) and while keyboard focus is on it. It sits top-right inside the swatch with no background,
 * drawn black or white, whichever reads better on this hex, with a thin halo of the other, in an invisible hit
 * area that reaches 4px past the glyph, so a click on the swatch body never removes.
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
const rootEl = ref<HTMLElement>()
/** Keyboard focus is on the swatch (or its ×); a click that merely focuses a button doesn't count. */
const focused = ref(false)
const isKeyboardFocus = (target: EventTarget | null) => {
  try {
    return (target as HTMLElement).matches(':focus-visible')
  } catch {
    return false // an engine without :focus-visible
  }
}
const onFocusIn = (event: FocusEvent) => {
  focused.value = isKeyboardFocus(event.target)
}
const onFocusOut = (event: FocusEvent) => {
  if (!rootEl.value?.contains(event.relatedTarget as Node | null)) focused.value = false
}
/** A mouse or pen is over the swatch (a touch has no hover, so it never sets this). */
const hovered = ref(false)
const onPointerEnter = (event: PointerEvent) => {
  if (event.pointerType !== 'touch') hovered.value = true
}
const onPointerLeave = () => {
  hovered.value = false
}
/** The first click on a swatch always selects it, even one that landed on the ×; only a selected swatch's × removes. */
const onRemove = () => {
  if (!props.selected) {
    // Do what a click on the chip does, focus included, so the Tab stop and the arrows follow.
    rootEl.value?.querySelector<HTMLElement>('.swatch__chip')?.focus()
    emit('select')
    return
  }
  hovered.value = false
  emit('remove')
}

/** The × is black or white by the swatch's own hex, whatever the theme. */
const mark = computed(() => markOn(props.color))
const showRemove = computed(() => (props.selected || hovered.value || focused.value) && !!props.removeLabel)
</script>

<template>
  <span
    ref="rootEl"
    class="swatch"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointercancel="onPointerLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
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
      @click="onRemove"
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

/* A button the size of the × and its 4px inset, with no look of its own: only the × shows, in the swatch's top-right corner. It stays small so a second click on the swatch body never removes. */
.swatch__remove {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  box-sizing: border-box;
  display: grid;
  place-items: start end;
  width: calc(var(--swatch-remove-size) + 2 * var(--space-4));
  height: calc(var(--swatch-remove-size) + 2 * var(--space-4));
  padding: var(--space-4);
  background: none;
  border: 0;
  cursor: pointer;
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
  width: var(--swatch-remove-size) !important;
  height: var(--swatch-remove-size) !important;
  color: var(--mark);
  stroke-width: var(--swatch-remove-stroke);
  filter: drop-shadow(0 0 var(--swatch-mark-halo) var(--mark-halo)) drop-shadow(0 0 var(--swatch-mark-halo) var(--mark-halo));
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
