<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import KeyChip from './KeyChip.vue'
import AppTooltip from './AppTooltip.vue'
import { actionKey, type ControlActionLike } from './controlAction'
import type { IconName, IconSize } from './icons'

// The one icon-only button (tickets 157, 330, 327, 439; ADR 0035): `label` is its name; a Tooltip shows only when given
// one or an `action`. A disabled one is `aria-disabled` (stays hoverable and focusable), its Tooltip saying why
// (`disabledBody`).
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    icon?: IconName
    label?: string
    /** A registry action: the source of the name, body, key, enabled state and disabled reason. */
    action?: ControlActionLike
    deps?: unknown
    shape?: 'square' | 'round'
    variant?: 'secondary' | 'in-box' | 'toolbox' | 'box' | 'plain' | 'tool' | 'pill'
    size?: 'md' | 'lg'
    iconSize?: IconSize
    selected?: boolean
    /** A `pill` tile's or `tool` tab's accent color (the active tool, the input mode toggle). */
    accent?: boolean
    /** A toggle, not a tab or a selection: `aria-pressed` follows this, with no underline (the input mode toggle). */
    pressed?: boolean
    disabled?: boolean
    /** The Tooltip's key chip (ticket 251): the control's shortcut, as the shortcuts help writes it. */
    shortcut?: string
    /** Why the button is disabled, shown by its Tooltip in place of the key chip. */
    disabledBody?: string
    /** The single key printed as a badge by the `tool` variant when `showHotkey` is set; also its Tooltip's key
     * chip. */
    hotkey?: string
    showHotkey?: boolean
    /** Gives the button a Tooltip: `true` for its name alone, or the body and side to show it on. */
    tooltip?: boolean | { body?: string; placement?: 'top' | 'bottom' }
  }>(),
  {
    icon: undefined,
    label: undefined,
    action: undefined,
    deps: undefined,
    shape: 'square',
    variant: 'secondary',
    size: 'md',
    iconSize: 15,
    selected: undefined,
    accent: false,
    pressed: undefined,
    disabled: undefined,
    shortcut: undefined,
    disabledBody: undefined,
    hotkey: undefined,
    showHotkey: false,
    tooltip: false,
  },
)

const { t } = useI18n()

const name = computed(() => props.label ?? props.action?.name(t.value) ?? '')
const iconName = computed(() => props.icon ?? props.action?.icon)
const isDisabled = computed(() => props.disabled ?? (props.action?.enabled ? !props.action.enabled(props.deps as never) : false))
const reason = computed(
  () => props.disabledBody ?? (props.action?.disabledBody && props.deps ? props.action.disabledBody(t.value, props.deps as never) : undefined),
)
const key = computed(() => props.shortcut ?? props.hotkey ?? actionKey(props.action))
const body = computed(() => {
  if (typeof props.tooltip === 'object' && props.tooltip.body !== undefined) return props.tooltip.body
  return props.action?.body?.(t.value)
})
const placement = computed(() => (typeof props.tooltip === 'object' ? props.tooltip.placement : undefined))

const tooltipProps = computed(() => {
  if (!props.tooltip && !props.action) return undefined
  if (isDisabled.value) {
    return reason.value === undefined ? undefined : { name: name.value, disabled: true as const, disabledBody: reason.value, placement: placement.value, announce: false }
  }
  return { name: name.value, hotkey: key.value, body: body.value, placement: placement.value, announce: false }
})

const isTool = computed(() => props.variant === 'tool')
const isPill = computed(() => props.variant === 'pill')
const keyed = computed(() => isTool.value || isPill.value)
const size = computed(() => (isTool.value ? 34 : isPill.value ? 22 : props.iconSize))

/** A disabled button swallows the click before any listener the parent attached sees it. */
function swallowClick(event: MouseEvent) {
  if (!isDisabled.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <component :is="tooltipProps ? AppTooltip : 'span'" v-bind="tooltipProps ?? {}" :class="{ 'icon-btn-wrap': true, 'icon-btn-wrap--tool': isTool, 'icon-btn-wrap--pill': isPill }">
    <button
      class="ui-control icon-btn"
      :class="[`icon-btn--${shape}`, `icon-btn--${variant}`, `icon-btn--${props.size}`, { 'icon-btn--selected': selected, 'icon-btn--accent': accent }]"
      type="button"
      :aria-label="name"
      :aria-pressed="pressed ?? selected"
      :aria-disabled="isDisabled ? 'true' : undefined"
      :aria-keyshortcuts="keyed ? hotkey : undefined"
      v-bind="$attrs"
      @click.capture="swallowClick"
    >
      <slot><AppIcon v-if="iconName" :name="iconName" :size="size" /></slot>
      <KeyChip v-if="keyed && showHotkey && hotkey" class="icon-btn__key" aria-hidden="true">{{ hotkey }}</KeyChip>
    </button>
  </component>
</template>

<style scoped>
.icon-btn-wrap {
  display: inline-flex;
}

/* The Tooltip's wrapper takes a Tool tab's grid cell, and the tab fills it. */
.icon-btn-wrap--tool {
  display: flex;
  min-width: 0;
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
  outline-offset: var(--focus-offset);
}

/* A Tool pill tile (ToolPill card): 40px, radius-lg, a 22px icon in `muted`; the active tool sits on `panel` with
 * its icon in `accent`. */
.icon-btn-wrap--pill {
  flex: none;
}

.icon-btn--pill {
  position: relative;
  width: var(--pill-tile);
  height: var(--pill-tile);
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: var(--radius-lg);
}

.icon-btn--pill.icon-btn--selected {
  color: var(--ink);
  background: var(--panel);
}

.icon-btn--pill.icon-btn--accent,
.icon-btn--pill.icon-btn--accent.icon-btn--selected {
  color: var(--accent);
}

/* The hotkey corner: the top-right of the tile, `meta-tiny`, `muted`, `accent-strong` on the active tile. */
.icon-btn--pill .icon-btn__key {
  top: var(--key-corner-top);
  right: var(--space-4);
  left: auto;
  font: var(--type-meta-tiny);
  color: var(--muted);
}

.icon-btn--pill.icon-btn--accent .icon-btn__key {
  color: var(--accent-strong);
}

/* A Tool tab (ToolTabs card): no fill, a 2px accent underline over the container's rule marks the selection. */
.icon-btn--tool {
  position: relative;
  width: var(--tab-width);
  height: var(--tab-height);
  min-width: 0;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: 0;
}

.icon-btn--tool.icon-btn--selected {
  color: var(--accent-strong);
  background: none;
}

.icon-btn--tool.icon-btn--selected::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--underline-width);
  background: var(--accent-strong);
}

.icon-btn--tool.icon-btn--accent {
  color: var(--accent-strong);
}

.icon-btn--tool:focus-visible {
  outline-offset: calc(-1 * var(--focus-offset));
}

/* The key sits against the icon's top-right corner: DM Mono 11px, `muted`, accent when selected. */
.icon-btn__key {
  position: absolute;
  top: calc(50% - var(--tool-key-up));
  left: calc(50% + var(--tool-key-right));
  font: var(--type-meta-tiny);
  line-height: 1;
  color: var(--muted);
}

.icon-btn--selected .icon-btn__key {
  color: var(--accent-strong);
}

@media (forced-colors: active) {
  .icon-btn--tool.icon-btn--selected::after {
    background: Highlight;
  }
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

  .icon-btn--tool:hover:not([aria-disabled='true']) {
    background: none;
  }

  .icon-btn--pill:hover:not([aria-disabled='true']) {
    color: var(--ink);
    background: var(--hover-fill);
  }

  .icon-btn--pill.icon-btn--accent:hover:not([aria-disabled='true']) {
    color: var(--accent);
  }

  .icon-btn--pill.icon-btn--selected:hover:not([aria-disabled='true']) {
    background: var(--panel);
  }

  .icon-btn--tool:hover:not([aria-disabled='true']):not(.icon-btn--selected) {
    color: var(--ink);
  }
}

.icon-btn:active:not([aria-disabled='true']) {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

.icon-btn--selected:active:not([aria-disabled='true']) {
  background: var(--ink);
}

.icon-btn--pill:active:not([aria-disabled='true']),
.icon-btn--pill.icon-btn--selected:active:not([aria-disabled='true']) {
  background: var(--press-fill);
  transform: none;
}

.icon-btn--tool:active:not([aria-disabled='true']) {
  background: none;
}

.icon-btn[aria-disabled='true'] {
  color: var(--faint);
  cursor: not-allowed;
}

:root[data-theme='contrast'] .icon-btn:not(.icon-btn--plain, .icon-btn--tool) {
  border-width: var(--border-emphasis);
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn:active:not([aria-disabled='true']) {
    transform: none;
  }
}
</style>
