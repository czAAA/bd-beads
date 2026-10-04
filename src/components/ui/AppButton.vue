<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

/**
 * The design system's Button (ticket 157; Button, InteractionStates and Motion cards). One per action: `primary` for
 * the single most likely next action in a region (two never sit side by side), `secondary` on the page, `in-box`
 * inside the save box and Saved Projects, `toolbox` for the Toolbox's own buttons, `box` in the canvas box's Progress
 * bar, `text` for Import a file and
 * Import QR code, `danger` only for a destructive modal's confirm. `selected` is the segment look (an `ink` fill) and
 * is announced with aria-pressed.
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'in-box' | 'toolbox' | 'box' | 'text' | 'danger'
    size?: 'md' | 'lg' | 'sm'
    icon?: IconName
    trailingIcon?: IconName
    selected?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'secondary', size: 'md', icon: undefined, trailingIcon: undefined, selected: undefined, type: 'button' },
)
</script>

<template>
  <button
    class="ui-control app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`, { 'app-button--selected': selected }]"
    :type="type"
    :disabled="disabled"
    :aria-pressed="selected === undefined ? undefined : selected"
  >
    <AppIcon v-if="icon" :name="icon" :size="15" />
    <slot />
    <AppIcon v-if="trailingIcon" class="app-button__trailing" :name="trailingIcon" :size="15" />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  height: var(--control-height);
  padding: 0 var(--space-12);
  box-sizing: border-box;
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

.app-button--lg {
  height: var(--control-height-lg);
}

.app-button--sm {
  height: var(--control-height-sm);
  font: var(--type-tab);
}

.app-button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.app-button__trailing {
  color: var(--muted);
}

.app-button--primary {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.app-button--in-box {
  background: var(--elevated);
  border-color: var(--in-box-line);
}

.app-button--toolbox {
  background: var(--elevated);
  border-color: var(--panel-line);
}

:root[data-theme='dark'] .app-button--toolbox {
  border-color: var(--elevated);
}

.app-button--box {
  background: var(--box-button);
  border-color: var(--box-button-line);
}

.app-button--text {
  padding: 0 var(--space-6);
  background: none;
  border-color: transparent;
}

.app-button--danger {
  color: var(--on-danger);
  background: var(--danger);
  border-color: var(--danger);
}

.app-button--primary .app-button__trailing,
.app-button--danger .app-button__trailing {
  color: inherit;
}

.app-button--selected {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

/* Hover exists only with a mouse or trackpad: on touch the pressed state is the only feedback. */
@media (hover: hover) {
  .app-button:hover:not(:disabled) {
    background: var(--hover-fill);
  }

  .app-button--primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .app-button--in-box:hover:not(:disabled),
  .app-button--toolbox:hover:not(:disabled) {
    background: var(--elevated);
    border-color: var(--ink);
  }

  .app-button--danger:hover:not(:disabled) {
    background: var(--danger);
  }

  .app-button--selected:hover:not(:disabled) {
    background: var(--ink);
  }
}

.app-button:active:not(:disabled) {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

.app-button--primary:active:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.app-button--danger:active:not(:disabled) {
  background: var(--danger);
}

.app-button--selected:active:not(:disabled) {
  background: var(--ink);
}

.app-button:disabled {
  color: var(--faint);
  background: var(--surface);
  border-color: var(--line);
  cursor: not-allowed;
}

.app-button--primary:disabled {
  color: var(--accent-disabled-fg);
  background: var(--accent-disabled-bg);
  border-color: var(--accent-disabled-bg);
}

.app-button--text:disabled {
  background: none;
  border-color: transparent;
}

:root[data-theme='contrast'] .app-button {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .app-button:active:not(:disabled) {
    transform: none;
  }
}
</style>
