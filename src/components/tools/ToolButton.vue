<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'

/**
 * A Tool button (CONTEXT.md; ticket 250): a square, icon-only button for one tool, the active one in the accent
 * colour. A tool with a single-key shortcut shows that key as a badge in the corner, on every device (ticket 275:
 * BottomToolbar, Dock and the phone ToolSheet all print it too, not just a keyboard-equipped desktop). `label` is the
 * accessible name; its Tooltip (ticket 251) shows the name, the key and the `description`, if the tool needs one.
 * Attributes and listeners (data-testid, tabindex, @click) go to the <button>.
 *
 * The `tile` variant (ticket 274; ToolTabs card) is the desktop Toolbox's swatch-sized tile: a borderless 16px icon
 * that turns `ink` with an inset accent outline when active.
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
    variant?: 'button' | 'tile'
  }>(),
  { iconSize: 22, hotkey: undefined, description: undefined, variant: 'button' },
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
        :class="[{ 'tool-button--active': active }, `tool-button--${variant}`]"
        :aria-label="label"
        :aria-keyshortcuts="hotkey"
        :aria-pressed="active"
        :aria-describedby="describedby"
        v-bind="$attrs"
      >
        <AppIcon :name="icon" :size="variant === 'tile' ? 16 : iconSize" />
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
  top: 3px;
  right: var(--space-4);
  font: var(--type-meta-tiny);
  line-height: 1;
  color: var(--muted);
}

/* Phone (BottomToolbar/Dock card; ToolSheet card): nothing is below 12px, so the badge steps up from meta-tiny. */
@media (max-width: 743px) {
  .tool-button__key {
    font: var(--type-meta-small);
  }
}

.tool-button--active .tool-button__key {
  color: var(--accent-strong);
}

/*
 * The tile (ToolTabs card, v18): a swatch-sized square, `elevated` fill, no border, `radius-sm`. The icon is centred by
 * the button's flex alone; the key is out of the flow in the top-right corner, so it never moves the icon. Active:
 * `ink` icon and a 1.5px inset `accent-strong` outline (3px in high contrast, a 2px Highlight outline in forced colors).
 */
.tool-button--tile {
  border: 0;
  border-radius: var(--radius-sm);
}

.tool-button--tile.tool-button--active {
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px var(--accent-strong);
}

:root[data-theme='contrast'] .tool-button--tile.tool-button--active {
  box-shadow: inset 0 0 0 3px var(--accent-strong);
}

@media (hover: hover) {
  .tool-button--tile:not(.tool-button--active):hover {
    color: var(--ink);
  }
}

.tool-button--tile .tool-button__key {
  top: 1px;
  right: 2px;
  font: 400 0.625rem/1 var(--font-mono);
  color: var(--muted);
}

.tool-button--tile.tool-button--active .tool-button__key,
:root[data-theme='contrast'] .tool-button--tile .tool-button__key {
  color: var(--ink);
}

@media (forced-colors: active) {
  .tool-button--tile.tool-button--active:not(:focus-visible) {
    box-shadow: none;
    outline: 2px solid Highlight;
    outline-offset: -2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-button:active {
    transform: none;
  }
}
</style>
