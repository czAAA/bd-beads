<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, useId, useSlots, watch } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import AppButton from './AppButton.vue'
import IconButton from './IconButton.vue'
import type { IconName } from './icons'
import { MENU_CLOSE } from './menuContext'
import { menuTooltipBody } from './menuTooltipBody'

type ButtonVariant = InstanceType<typeof AppButton>['$props']['variant']
type IconVariant = InstanceType<typeof IconButton>['$props']['variant']

/**
 * The one button that opens something (ticket 332, ADR 0035): an IconButton (`icon-only`) or an AppButton with a
 * trailing chevron, which opens a popover under it from 1024px up, or a sheet under that. It owns `aria-haspopup`,
 * `aria-expanded`, focus return and closing on Escape or a press outside, so the Export menu, the header Menu, the
 * Dock's slots, Image colors, Canvas color and the Custom color picker don't each write them again.
 *
 * What it opens is the default slot: AppMenuItems for a `menu`, or any content for a `popover` (a small dialog: Tab
 * moves through it and leaving it closes it). A phone shows the `sheet` slot instead, given a `close` function, and
 * falls back to the popover when there is none (ui/ imports no feature folder, ADR 0020, so the BottomSheet itself is
 * the caller's). Its Tooltip body is `tooltip`, or the `items` names written as "A, B, C." (the Dock slots' "Set
 * Frame, Rotate, Copy, Paste."). An icon-only button always has a Tooltip (its name, ADR 0035), a labelled one only when
 * there is a body that adds something. An icon-only button may draw its own face in the `icon` slot (the Canvas color dot). Attributes and listeners (data-testid) go to the button itself.
 */
defineOptions({ inheritAttrs: false })
const emit = defineEmits<{ open: [] }>()
const props = withDefaults(
  defineProps<{
    /** The button's text, or its accessible name when `iconOnly`. */
    label: string
    icon?: IconName
    iconOnly?: boolean
    /** Names of what it opens; its Tooltip body lists them. */
    items?: readonly string[]
    /** The Tooltip's body, in place of the list of `items`. */
    tooltip?: string
    /** The look of the AppButton or the IconButton it wraps. */
    variant?: ButtonVariant | IconVariant
    size?: 'md' | 'lg'
    /** Which edge of the button the popover lines up with. */
    align?: 'start' | 'end'
    /** The popup is a small dialog, not a list of items. */
    popover?: boolean
    disabled?: boolean
    disabledBody?: string
  }>(),
  {
    icon: undefined,
    iconOnly: false,
    items: undefined,
    tooltip: undefined,
    variant: undefined,
    size: 'md',
    align: 'start',
    popover: false,
    disabled: undefined,
    disabledBody: undefined,
  },
)

/** Under 1024px a menu opens as a sheet. */
const narrow = useMediaQuery('(max-width: 1023px)')
const slots = useSlots()
/** A sheet is what a phone opens, when the caller gave one: it brings its own Escape layer and outside press. */
const showsSheet = computed(() => narrow.value && !!slots.sheet)

const open = ref(false)
const rootEl = ref<HTMLElement>()
const listEl = ref<HTMLElement>()
const buttonEl = ref<HTMLElement>()
const listId = useId()
const anchored = useAnchoredPosition(buttonEl, listEl, () => props.align)

const iconVariant = computed(() => props.variant as IconVariant)
const buttonVariant = computed(() => (props.variant ?? 'secondary') as ButtonVariant)
const popup = computed(() => (props.popover || showsSheet.value ? 'dialog' : 'menu'))
const tooltipBody = computed(() => props.tooltip ?? (props.items ? menuTooltipBody(props.items) : undefined))
const tooltipProps = computed(() => (tooltipBody.value === undefined ? true : { body: tooltipBody.value }))

function trigger(): HTMLElement | null {
  return rootEl.value?.querySelector<HTMLElement>('[aria-haspopup]') ?? null
}

function focusTargets(): HTMLElement[] {
  const selector = props.popover ? 'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])' : '[role="menuitem"]:not(:disabled)'
  return [...(listEl.value?.querySelectorAll<HTMLElement>(selector) ?? [])]
}

function onPointerDownOutside(event: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) close(false)
}

async function show(focus?: 'first' | 'last') {
  if (props.disabled) return
  open.value = true
  // A sheet closes itself on a press outside it; its content may sit outside this button's own element.
  if (!showsSheet.value) document.addEventListener('pointerdown', onPointerDownOutside)
  await nextTick()
  buttonEl.value = trigger() ?? undefined
  anchored.follow()
  if (focus) (focus === 'first' ? focusTargets()[0] : focusTargets().at(-1))?.focus()
  emit('open')
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside)
  anchored.stop()
  if (returnFocus) trigger()?.focus()
}

/** Crossing 1024px while open swaps the popover for a sheet or back: close rather than keep a stale one. */
watch(showsSheet, () => close(false))

provide(MENU_CLOSE, () => close())
/** ImageColorsButton closes the menu from its own swatch handler. */
defineExpose({ close })
useEscapeLayer(() => open.value && !showsSheet.value, () => close())
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside))

function onButtonClick(event: MouseEvent) {
  if (props.disabled) return
  if (open.value) close(false)
  // A click from the keyboard (Enter or Space) arrives with no pointer detail: focus goes into the popup then.
  else void show(event.detail === 0 && !showsSheet.value ? 'first' : undefined)
}

function onButtonKeydown(event: KeyboardEvent) {
  if (showsSheet.value || props.disabled) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    void show('first')
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    void show('last')
  }
}

/** A popover closes when focus leaves it for somewhere else. */
function onFocusOut(event: FocusEvent) {
  if (props.popover && open.value && event.relatedTarget instanceof Node && !rootEl.value?.contains(event.relatedTarget)) close(false)
}

function onListKeydown(event: KeyboardEvent) {
  if (props.popover) return
  if (event.key === 'Tab') {
    close(false)
    return
  }
  const list = focusTargets()
  const current = list.indexOf(document.activeElement as HTMLElement)
  const last = list.length - 1
  const next =
    event.key === 'ArrowDown'
      ? current >= last ? 0 : current + 1
      : event.key === 'ArrowUp'
        ? current <= 0 ? last : current - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined
  if (next === undefined) return
  event.preventDefault()
  // The app's own hotkeys (Home, End, the arrows) don't also run while moving inside the menu.
  event.stopPropagation()
  list[next]?.focus()
}

</script>

<template>
  <div ref="rootEl" class="menu-button">
    <IconButton
      v-if="iconOnly"
      v-bind="$attrs"
      :icon="icon"
      :label="label"
      :variant="iconVariant"
      :size="size"
      :disabled="disabled"
      :disabled-body="disabledBody"
      :tooltip="tooltipProps"
      :aria-haspopup="popup"
      :aria-expanded="open"
      :aria-controls="open && !showsSheet ? listId : undefined"
      @click="onButtonClick"
      @keydown="onButtonKeydown"
    >
      <slot v-if="$slots.icon" name="icon" />
    </IconButton>
    <AppButton
      v-else
      v-bind="$attrs"
      :variant="buttonVariant"
      :size="size"
      :icon="icon"
      trailing-icon="chevron-down"
      :label="label"
      :disabled="disabled"
      :disabled-body="disabledBody"
      :tooltip="tooltipBody === undefined ? undefined : { body: tooltipBody }"
      :aria-haspopup="popup"
      :aria-expanded="open"
      :aria-controls="open && !showsSheet ? listId : undefined"
      @click="onButtonClick"
      @keydown="onButtonKeydown"
    >
      {{ label }}
    </AppButton>
    <template v-if="open">
      <slot v-if="showsSheet" name="sheet" :close="() => close()" />
      <div
        v-else
        :id="listId"
        ref="listEl"
        class="menu-button__list"
        :class="[`menu-button__list--${align}`, { 'menu-button__list--popover': popover }]"
        :style="anchored.style.value"
        :role="popup"
        :aria-label="label"
        @keydown="onListKeydown"
        @focusout="onFocusOut"
      >
        <slot />
        <div v-if="$slots.footer" class="menu-button__footer">
          <slot name="footer" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.menu-button {
  position: relative;
  display: inline-flex;
}

.menu-button__list {
  position: absolute;
  top: calc(100% + var(--space-4));
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: var(--menu-width);
  padding: var(--space-4);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

.menu-button__list--popover {
  width: var(--popover-width);
  padding: var(--space-14);
  border-radius: var(--popover-radius);
}

.menu-button__list--start {
  left: 0;
}

.menu-button__list--end {
  right: 0;
}

:root[data-theme='contrast'] .menu-button__list {
  border-width: 2px;
  box-shadow: none;
}

.menu-button__footer {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-soft);
}
</style>
