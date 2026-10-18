<script setup lang="ts">
import { nextTick, provide, ref, useId } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import AppButton from './AppButton.vue'
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'
import { MENU_CLOSE } from './menuContext'

// The design system's Menu (ticket 76; Menu card): a button with a trailing chevron opening a popup list 4px under it;
// items are AppMenuItems, the `footer` slot a row under a rule. Arrows, Home and End move; choosing, Escape, Tab or a
// press outside closes it, and Escape and a choice return focus to the button.
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    label: string
    icon?: IconName
    variant?: 'secondary' | 'in-box'
    size?: 'md' | 'lg'
    /** Which edge of the button the menu lines up with. */
    align?: 'start' | 'end'
    /** The header menu's trigger (HeaderMenu card): just the icon in a ghost button, no label or chevron; `label` is
     * its accessible name. */
    iconOnly?: boolean
    /** The popup is a small dialog of its own (the Export prompt "Set Frame to export", SaveBox card), not a list of
     * items: Tab moves through it and leaving it closes it. */
    popover?: boolean
  }>(),
  { icon: undefined, variant: 'secondary', size: 'md', align: 'start', iconOnly: false, popover: false },
)

const open = ref(false)
const rootEl = ref<HTMLElement>()
const menuEl = ref<HTMLElement>()
const menuId = useId()
const buttonEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(buttonEl, menuEl, () => props.align)

function items(): HTMLElement[] {
  const selector = props.popover ? 'button:not(:disabled)' : '[role="menuitem"]:not(:disabled)'
  return [...(menuEl.value?.querySelectorAll<HTMLElement>(selector) ?? [])]
}

async function show(focus?: 'first' | 'last') {
  open.value = true
  await nextTick()
  buttonEl.value = rootEl.value?.querySelector<HTMLElement>('[aria-haspopup]') ?? undefined
  anchored.follow()
  if (focus) (focus === 'first' ? items()[0] : items().at(-1))?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  anchored.stop()
  if (returnFocus) rootEl.value?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
}

provide(MENU_CLOSE, () => close())
useOverlayLayer({ isOpen: () => open.value, root: () => rootEl.value, close: () => close(), onOutsidePress: () => close(false) })

function onButtonClick(event: MouseEvent) {
  if (open.value) {
    close(false)
  } else {
    // A click from the keyboard (Enter or Space) arrives with no pointer detail: focus goes into the menu then.
    void show(event.detail === 0 ? 'first' : undefined)
  }
}

function onButtonKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
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

function onMenuKeydown(event: KeyboardEvent) {
  if (props.popover) return
  if (event.key === 'Tab') {
    close(false)
    return
  }
  const list = items()
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

defineExpose({ close })
</script>

<template>
  <div ref="rootEl" class="app-menu">
    <button
      v-if="iconOnly"
      v-bind="$attrs"
      type="button"
      class="ui-control app-menu__icon-button"
      :class="{ 'app-menu__icon-button--open': open }"
      :aria-label="label"
      :aria-haspopup="popover ? 'dialog' : 'menu'"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      @click="onButtonClick"
      @keydown="onButtonKeydown"
    >
      <AppIcon :name="icon ?? 'menu'" :size="18" />
    </button>
    <AppButton
      v-else
      v-bind="$attrs"
      :variant="variant"
      :size="size"
      :icon="icon"
      trailing-icon="chevron-down"
      :aria-haspopup="popover ? 'dialog' : 'menu'"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      @click="onButtonClick"
      @keydown="onButtonKeydown"
    >
      {{ label }}
    </AppButton>
    <Transition name="app-menu">
      <div
        v-if="open"
        :id="menuId"
        ref="menuEl"
        class="app-menu__list"
        :class="[`app-menu__list--${align}`, { 'app-menu__list--popover': popover }]"
        :style="anchored.style.value"
        :role="popover ? 'dialog' : 'menu'"
        :aria-label="label"
        @keydown="onMenuKeydown"
        @focusout="onFocusOut"
      >
        <slot />
        <div v-if="$slots.footer" class="app-menu__footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-menu {
  position: relative;
  display: inline-flex;
}

.app-menu__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

/* 40px on the phone, its icon 20px (HeaderMenu card). */
@media (max-width: 743px) {
  .app-menu__icon-button {
      width: 2.5rem;
    height: 2.5rem;
  }

  .app-menu__icon-button :deep(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
}

.app-menu__icon-button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.app-menu__icon-button--open {
  background: var(--press-fill);
}

@media (hover: hover) {
  .app-menu__icon-button:hover:not(.app-menu__icon-button--open) {
    background: var(--hover-fill);
  }
}

.app-menu__list {
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

/* The Export prompt (SaveBox card): 288px, padding 14, radius 10. */
.app-menu__list--popover {
  width: var(--popover-width);
  padding: var(--space-14);
  border-radius: var(--popover-radius);
}

.app-menu__list--start {
  left: 0;
}

.app-menu__list--end {
  right: 0;
}

:root[data-theme='contrast'] .app-menu__list {
  border-width: 2px;
  box-shadow: none;
}

.app-menu__footer {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-soft);
}

/* Arriving 200ms, leaving 150ms (Motion card); reduced motion fades without the slide. */
.app-menu-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.app-menu-leave-active {
  transition:
    opacity calc(var(--duration-base) * 0.75) var(--ease-in),
    transform calc(var(--duration-base) * 0.75) var(--ease-in);
}

.app-menu-enter-from,
.app-menu-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-4)));
}

@media (prefers-reduced-motion: reduce) {
  .app-menu-enter-from,
  .app-menu-leave-to {
    transform: none;
  }
}
</style>
