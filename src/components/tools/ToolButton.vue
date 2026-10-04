<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'

/**
 * A Tool button (CONTEXT.md; ticket 250): a square, icon-only button for one tool, the active one in the accent
 * colour. A tool with a single-key shortcut shows that key as a badge in the corner (hidden on a coarse pointer and on
 * phone, where there is no keyboard). `label` is the accessible name; its Tooltip (ticket 251) shows the name, the key
 * and the `description`, if the tool needs one. Attributes and listeners (data-testid, tabindex, @click) go to the <button>.
 */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    icon: IconName
    label: string
    active: boolean
    /** The tool's single-key shortcut, as shown on its badge ("1", "H", "E"). */
    hotkey?: string
    description?: string
    iconSize?: 18 | 22
  }>(),
  { iconSize: 22, hotkey: undefined, description: undefined },
)
</script>

<template>
  <AppTooltip
    class="tool-button-wrap"
    :text="label"
    :shortcut="hotkey"
    :description="description"
    :announce="!!description"
  >
    <template #default="{ describedby }">
      <button
        type="button"
        class="ui-control tool-button"
        :class="{ 'tool-button--active': active }"
        :aria-label="label"
        :aria-pressed="active"
        :aria-describedby="describedby"
        v-bind="$attrs"
      >
        <AppIcon :name="icon" :size="iconSize" />
        <span v-if="hotkey" class="tool-button__key" aria-hidden="true">{{ hotkey }}</span>
      </button>
    </template>
  </AppTooltip>
</template>

<style scoped>
/* The Tooltip's wrapper takes the grid cell, and the button fills it. */
.tool-button-wrap {
  display: flex;
  min-width: 0;
}

.tool-button {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  color: var(--muted);
  background: var(--elevated);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

:root[data-theme='dark'] .tool-button {
  border-color: var(--elevated);
}

.tool-button--active {
  color: var(--accent-strong);
  border-color: var(--accent-strong);
}

:root[data-theme='dark'] .tool-button--active {
  border-color: var(--accent-strong);
}

:root[data-theme='contrast'] .tool-button--active {
  border-width: 2px;
}

@media (hover: hover) {
  .tool-button:not(.tool-button--active):hover {
    color: var(--ink);
    border-color: var(--ink);
  }
}

.tool-button:active {
  transform: scale(var(--press-scale));
}

.tool-button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.tool-button__key {
  position: absolute;
  top: var(--space-2);
  right: var(--space-4);
  font: var(--type-meta-tiny);
  line-height: 1;
  color: var(--faint);
}

.tool-button--active .tool-button__key {
  color: var(--accent-strong);
}

/* No keyboard on touch or phone, so no key to show. */
@media (pointer: coarse), (max-width: 743px) {
  .tool-button__key {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-button:active {
    transform: none;
  }
}
</style>
