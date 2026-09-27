<script setup lang="ts">
import { nextTick, onBeforeUnmount, provide, ref, useId } from 'vue'
import { useAnchoredPosition } from '../composables/useAnchoredPosition'
import { useEscapeLayer } from '../composables/useEscapeLayer'
import AppButton from './AppButton.vue'
import type { IconName } from './icons'
import { MENU_CLOSE } from './menuContext'

/**
 * The design system's Menu (ticket 76; Menu card): a button with a trailing chevron that opens a popup list 4px under
 * it (Export ▾). Items are AppMenuItems in the default slot; the `footer` slot takes a row under a rule (the Export
 * menu's name on exports). The arrows, Home and End move between items; choosing one, Escape, Tab or a press outside
 * closes the menu, and Escape and a choice give focus back to the button.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    label: string
    icon?: IconName
    variant?: 'secondary' | 'in-box'
    size?: 'md' | 'lg'
    /** Which edge of the button the menu lines up with. */
    align?: 'start' | 'end'
  }>(),
  { icon: undefined, variant: 'secondary', size: 'md', align: 'start' },
)

const open = ref(false)
const rootEl = ref<HTMLElement>()
const menuEl = ref<HTMLElement>()
const menuId = useId()
const buttonEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(buttonEl, menuEl, () => props.align)

function items(): HTMLElement[] {
  return [...(menuEl.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
}

function onPointerDownOutside(event: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) close(false)
}

async function show(focus?: 'first' | 'last') {
  open.value = true
  document.addEventListener('pointerdown', onPointerDownOutside)
  await nextTick()
  buttonEl.value = rootEl.value?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? undefined
  anchored.follow()
  if (focus) (focus === 'first' ? items()[0] : items().at(-1))?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside)
  anchored.stop()
  if (returnFocus) rootEl.value?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
}

provide(MENU_CLOSE, () => close())
useEscapeLayer(() => open.value, () => close())
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside))

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

function onMenuKeydown(event: KeyboardEvent) {
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
    <AppButton
      v-bind="$attrs"
      :variant="variant"
      :size="size"
      :icon="icon"
      trailing-icon="chevron-down"
      aria-haspopup="menu"
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
        :class="`app-menu__list--${align}`"
        :style="anchored.style.value"
        role="menu"
        :aria-label="label"
        @keydown="onMenuKeydown"
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
