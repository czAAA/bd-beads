<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import type { IconName, IconSize } from './icons'

/**
 * An icon-only button (ticket 157; Button card): `square` (34 × 34, radius 8: Turn row direction) or `round`
 * (radius full: Keyboard shortcuts), in the secondary, in-box, toolbox or canvas-box (`box`) look, or `plain` (30px, no fill: the canvas
 * strip's zoom buttons). Its accessible name is `label`, which a tooltip also shows on hover and keyboard focus.
 * Attributes and listeners (data-testid, @click) go to the <button> itself, not the tooltip around it.
 */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    icon: IconName
    label: string
    shape?: 'square' | 'round'
    variant?: 'secondary' | 'in-box' | 'toolbox' | 'box' | 'plain'
    size?: 'md' | 'lg'
    iconSize?: IconSize
    selected?: boolean
    disabled?: boolean
  }>(),
  { shape: 'square', variant: 'secondary', size: 'md', iconSize: 15, selected: undefined },
)
</script>

<template>
  <AppTooltip :text="label" :announce="false">
    <button
      class="ui-control icon-btn"
      :class="[`icon-btn--${shape}`, `icon-btn--${variant}`, `icon-btn--${size}`, { 'icon-btn--selected': selected }]"
      type="button"
      :aria-label="label"
      :aria-pressed="selected === undefined ? undefined : selected"
      :disabled="disabled"
      v-bind="$attrs"
    >
      <AppIcon :name="icon" :size="iconSize" />
    </button>
  </AppTooltip>
</template>

<style scoped>
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
  .icon-btn:hover:not(:disabled) {
    background: var(--hover-fill);
  }

  .icon-btn--in-box:hover:not(:disabled),
  .icon-btn--toolbox:hover:not(:disabled) {
    background: var(--elevated);
    border-color: var(--ink);
  }

  .icon-btn--selected:hover:not(:disabled) {
    background: var(--ink);
  }
}

.icon-btn:active:not(:disabled) {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

.icon-btn--selected:active:not(:disabled) {
  background: var(--ink);
}

.icon-btn:disabled {
  color: var(--faint);
  cursor: not-allowed;
}

:root[data-theme='contrast'] .icon-btn:not(.icon-btn--plain) {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
