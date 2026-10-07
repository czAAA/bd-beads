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
 * It is a tab (ticket 292; ToolTabs card): a 34px icon in a 56px-wide, 72px-tall cell, no background, selected by a 2px
 * accent underline. The container sets the width (`--tab-width`, never below 44px) and the height (`--tab-height`) and
 * draws the full-width rule the underline sits on.
 */
defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    icon: IconName
    label: string
    active: boolean
    /** A toggle, not a tab (ticket 325): `aria-pressed` follows this, and the icon takes the accent colour with no underline. */
    pressed?: boolean
    /** The tool's single-key shortcut, as shown on its badge ("1", "5", "4"). */
    hotkey?: string
    description?: string
  }>(),
  { pressed: undefined, hotkey: undefined, description: undefined },
)
</script>

<template>
  <AppTooltip
    class="tool-button-wrap"
    :name="label"
    :hotkey="hotkey"
    :body="description"
    :announce="!!description"
  >
    <template #default="{ describedby }">
      <button
        type="button"
        class="ui-control tool-button"
        :class="{ 'tool-button--active': active, 'tool-button--toggle': pressed !== undefined }"
        :aria-label="label"
        :aria-keyshortcuts="hotkey"
        :aria-pressed="pressed ?? active"
        :aria-describedby="describedby"
        v-bind="$attrs"
      >
        <AppIcon :name="icon" :size="34" />
        <span v-if="hotkey" class="tool-button__key" aria-hidden="true">{{ hotkey }}</span>
      </button>
    </template>
  </AppTooltip>
</template>

<style scoped>
/* The Tooltip's wrapper takes the grid cell, and the tab fills it. */
.tool-button-wrap {
  display: flex;
  min-width: 0;
}

.tool-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--tab-width, 56px);
  height: var(--tab-height, 72px);
  min-width: 0;
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-instant) var(--ease-standard);
}

/* The selection: a 2px accent underline over the container's 1px rule (3px in high contrast). */
.tool-button--active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--accent-strong);
}

:root[data-theme='contrast'] .tool-button--active::after {
  height: 3px;
}

.tool-button--active {
  color: var(--accent-strong);
}

/* A toggle shows its current face in the accent colour and has no tab underline. */
.tool-button--toggle {
  color: var(--accent-strong);
}

@media (hover: hover) {
  .tool-button:not(.tool-button--active):hover {
    color: var(--ink);
  }
}

.tool-button:active {
  transform: scale(var(--press-scale));
}

.tool-button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: -2px;
}

/* The key sits against the icon's top-right corner: DM Mono 11px, `muted`, accent when active. */
.tool-button__key {
  position: absolute;
  top: calc(50% - 17px - 6px);
  left: calc(50% + 17px - 2px);
  font: 400 0.6875rem/1 var(--font-mono);
  color: var(--muted);
}

.tool-button--active .tool-button__key {
  color: var(--accent-strong);
}

@media (forced-colors: active) {
  .tool-button--active::after {
    background: Highlight;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-button:active {
    transform: none;
  }
}
</style>
