<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import type { IconName, IconSize } from './icons'

/**
 * An icon-only button (ticket 157; Button card): `square` (34 × 34, radius 8: Turn row direction) or `round`
 * (radius full: Keyboard shortcuts), in the secondary, in-box, toolbox or canvas-box (`box`) look, or `plain` (30px, no fill: the canvas
 * strip's zoom buttons). Its accessible name is `label`, which a tooltip also shows on hover and keyboard focus.
 * Attributes and listeners (data-testid, @click) go to the <button> itself, not the tooltip around it.
 *
 * A disabled button (ticket 327) is `aria-disabled`, not natively disabled, so it stays hoverable and focusable and a
 * click does nothing. Its Tooltip says why (`disabledBody`); a disabled button given no reason shows no Tooltip.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    icon: IconName
    label: string
    shape?: 'square' | 'round'
    variant?: 'secondary' | 'in-box' | 'toolbox' | 'box' | 'plain'
    size?: 'md' | 'lg'
    iconSize?: IconSize
    selected?: boolean
    disabled?: boolean
    /** The Tooltip's key chip (ticket 251): the control's shortcut, as the shortcuts help writes it. */
    shortcut?: string
    /** Why the button is disabled, shown by its Tooltip in place of the key chip. */
    disabledBody?: string
  }>(),
  { shape: 'square', variant: 'secondary', size: 'md', iconSize: 15, selected: undefined, shortcut: undefined, disabledBody: undefined },
)

const tooltip = computed(() =>
  props.disabled
    ? props.disabledBody === undefined
      ? undefined
      : { name: props.label, disabled: true as const, disabledBody: props.disabledBody, announce: false }
    : { name: props.label, hotkey: props.shortcut, announce: false },
)

/** A disabled button swallows the click before any listener the parent attached sees it. */
function swallowClick(event: MouseEvent) {
  if (!props.disabled) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <component :is="tooltip ? AppTooltip : 'span'" v-bind="tooltip ?? { class: 'icon-btn-wrap' }">
    <button
      class="ui-control icon-btn"
      :class="[`icon-btn--${shape}`, `icon-btn--${variant}`, `icon-btn--${size}`, { 'icon-btn--selected': selected }]"
      type="button"
      :aria-label="label"
      :aria-pressed="selected === undefined ? undefined : selected"
      :aria-disabled="disabled ? 'true' : undefined"
      v-bind="$attrs"
      @click.capture="swallowClick"
    >
      <AppIcon :name="icon" :size="iconSize" />
    </button>
  </component>
</template>

<style scoped>
.icon-btn-wrap {
  display: inline-flex;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  box-sizing: border-box;
  color: var(--ink);
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

.icon-btn--lg {
  width: var(--control-height-lg);
  height: var(--control-height-lg);
}

.icon-btn--round {
  border-radius: var(--radius-full);
}

.icon-btn--in-box {
  background: var(--elevated);
  border-color: var(--in-box-line);
}

.icon-btn--toolbox {
  background: var(--elevated);
  border-color: var(--panel-line);
}

:root[data-theme='dark'] .icon-btn--toolbox {
  border-color: var(--elevated);
}

.icon-btn--box {
  background: var(--box-button);
  border-color: var(--box-button-line);
}

.icon-btn--plain {
  width: var(--control-height-plain);
  height: var(--control-height-plain);
  background: none;
  border-color: transparent;
  border-radius: var(--radius-sm);
}

.icon-btn--selected {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

.icon-btn:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

@media (hover: hover) {
  .icon-btn:hover:not([aria-disabled='true']) {
    background: var(--hover-fill);
  }

  .icon-btn--in-box:hover:not([aria-disabled='true']),
  .icon-btn--toolbox:hover:not([aria-disabled='true']) {
    background: var(--elevated);
    border-color: var(--ink);
  }

  .icon-btn--selected:hover:not([aria-disabled='true']) {
    background: var(--ink);
  }
}

.icon-btn:active:not([aria-disabled='true']) {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

.icon-btn--selected:active:not([aria-disabled='true']) {
  background: var(--ink);
}

.icon-btn[aria-disabled='true'] {
  color: var(--faint);
  cursor: not-allowed;
}

:root[data-theme='contrast'] .icon-btn:not(.icon-btn--plain) {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn:active:not([aria-disabled='true']) {
    transform: none;
  }
}
</style>
