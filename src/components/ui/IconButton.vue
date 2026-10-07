<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import type { Translations } from '../../i18n/translations'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import type { IconName, IconSize } from './icons'

/**
 * The one icon-only button (tickets 157, 330; Button card): `square` (34 × 34, radius 8: Turn row direction) or `round`
 * (radius full: Keyboard shortcuts), in the secondary, in-box, toolbox or canvas-box (`box`) look, `plain` (30px, no fill:
 * the canvas strip's zoom buttons) or `tool` (a Tool tab: a 34px icon in a 56 × 72 cell, selected by a 2px accent
 * underline). Its accessible name is `label`. Attributes and listeners (data-testid, @click) go to the <button> itself,
 * not the tooltip around it.
 *
 * It shows a Tooltip exactly when it is given one (ADR 0035): `tooltip` (`true` for the name alone, or a `body` and
 * `placement`) or an `action` from the control registry, which supplies the name, body, key chip, enabled state and the
 * reason it is disabled (`deps` is what the action's `enabled` reads). `hotkey` is the single key a `tool` prints as a
 * badge when `showHotkey` is set.
 *
 * A disabled button (ticket 327) is `aria-disabled`, not natively disabled, so it stays hoverable and focusable and a
 * click does nothing. Its Tooltip says why (`disabledBody`); a disabled button given no reason shows no Tooltip.
 */
defineOptions({ inheritAttrs: false })

/** What an `action` is to this button: the control registry's `ControlAction`, seen structurally (ADR 0024: `ui/`
 * imports from no feature folder). `deps` is whatever the action's `enabled` and `disabledBody` read. */
interface IconButtonAction {
  icon?: IconName
  name: (t: Translations) => string
  body?: (t: Translations) => string
  chords: readonly { mod?: boolean; ctrl?: boolean; shift?: boolean | 'any'; label: string }[]
  enabled?: (deps: never) => boolean
  disabledBody?: (t: Translations, deps: never) => string
}
const props = withDefaults(
  defineProps<{
    icon?: IconName
    label?: string
    /** A registry action: the source of the name, body, key, enabled state and disabled reason. */
    action?: IconButtonAction
    deps?: unknown
    shape?: 'square' | 'round'
    variant?: 'secondary' | 'in-box' | 'toolbox' | 'box' | 'plain' | 'tool'
    size?: 'md' | 'lg'
    iconSize?: IconSize
    selected?: boolean
    disabled?: boolean
    /** The Tooltip's key chip (ticket 251): the control's shortcut, as the shortcuts help writes it. */
    shortcut?: string
    /** Why the button is disabled, shown by its Tooltip in place of the key chip. */
    disabledBody?: string
    /** The single key printed as a badge by the `tool` variant when `showHotkey` is set; also its Tooltip's key chip. */
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
const key = computed(() => {
  if (props.shortcut ?? props.hotkey) return props.shortcut ?? props.hotkey
  const chord = props.action?.chords[0]
  if (!chord) return undefined
  return [chord.mod ? 'Ctrl/Cmd' : chord.ctrl ? 'Ctrl' : '', chord.shift === true ? 'Shift' : '', chord.label].filter(Boolean).join('+')
})
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
const size = computed(() => (isTool.value ? 34 : props.iconSize))

/** A disabled button swallows the click before any listener the parent attached sees it. */
function swallowClick(event: MouseEvent) {
  if (!isDisabled.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <component :is="tooltipProps ? AppTooltip : 'span'" v-bind="tooltipProps ?? {}" :class="{ 'icon-btn-wrap': true, 'icon-btn-wrap--tool': isTool }">
    <button
      class="ui-control icon-btn"
      :class="[`icon-btn--${shape}`, `icon-btn--${variant}`, `icon-btn--${props.size}`, { 'icon-btn--selected': selected }]"
      type="button"
      :aria-label="name"
      :aria-pressed="selected === undefined ? undefined : selected"
      :aria-disabled="isDisabled ? 'true' : undefined"
      :aria-keyshortcuts="isTool ? hotkey : undefined"
      v-bind="$attrs"
      @click.capture="swallowClick"
    >
      <AppIcon v-if="iconName" :name="iconName" :size="size" />
      <span v-if="isTool && showHotkey && hotkey" class="icon-btn__key" aria-hidden="true">{{ hotkey }}</span>
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
  outline-offset: 2px;
}

/* A Tool tab (ToolTabs card): no fill, a 2px accent underline over the container's rule marks the selection. */
.icon-btn--tool {
  position: relative;
  width: var(--tab-width, 3.5rem);
  height: var(--tab-height, 4.5rem);
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
  height: 2px;
  background: var(--accent-strong);
}

:root[data-theme='contrast'] .icon-btn--tool.icon-btn--selected::after {
  height: 3px;
}

.icon-btn--tool:focus-visible {
  outline-offset: -2px;
}

/* The key sits against the icon's top-right corner: DM Mono 11px, `muted`, accent when selected. */
.icon-btn__key {
  position: absolute;
  top: calc(50% - 1.4375rem);
  left: calc(50% + 0.9375rem);
  font: 400 0.6875rem/1 var(--font-mono);
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

.icon-btn--tool:active:not([aria-disabled='true']) {
  background: none;
}

.icon-btn[aria-disabled='true'] {
  color: var(--faint);
  cursor: not-allowed;
}

:root[data-theme='contrast'] .icon-btn:not(.icon-btn--plain, .icon-btn--tool) {
  border-width: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn:active:not([aria-disabled='true']) {
    transform: none;
  }
}
</style>
