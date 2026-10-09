<script setup lang="ts">
import { computed, mergeProps } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import { actionKey, type ControlActionLike } from './controlAction'
import type { IconName } from './icons'

/**
 * The one labelled button (tickets 157, 331; Button card): an optional leading icon, the label, and an optional
 * trailing icon. `primary` is the single most likely next action in a region (two never sit side by side), `secondary`
 * sits on the page, `in-box` inside the save box and Saved Projects, `toolbox` is the Toolbox's own, `box` the canvas
 * box's Progress bar, `text` Import a file and Import QR code, `danger` only a destructive modal's confirm, and `link`
 * reads as a link (Remove line in `ink`; `danger` makes it Delete all's `danger`). `selected` is the segment look (an
 * `ink` fill), announced with aria-pressed. Attributes and listeners (data-testid, @click) go to the <button> itself,
 * not the wrapper around it.
 *
 * It shows a Tooltip exactly when it is given one (ADR 0035): `tooltip`, a sentence that adds something the label
 * doesn't ("Start an empty canvas."), or an `action` from the control registry, which supplies the label, body, key
 * chip, enabled state and the reason it is disabled (`deps` is what the action's `enabled` reads). The label is the
 * default slot, or the action's name when the slot is empty.
 *
 * A disabled button (ticket 327) is `aria-disabled`, not natively disabled, so it stays hoverable and focusable and a
 * click does nothing. Its Tooltip says why (`disabledBody`); a disabled button given no reason shows no Tooltip.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'in-box' | 'toolbox' | 'box' | 'text' | 'danger' | 'link'
    size?: 'md' | 'lg' | 'sm'
    icon?: IconName
    trailingIcon?: IconName
    /** `link` only: the destructive color. */
    danger?: boolean
    selected?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
    /** A registry action: the source of the label, body, key, enabled state and disabled reason. */
    action?: ControlActionLike
    deps?: unknown
    /** The label as a disabled Tooltip names it, for a button whose label is the slot; an `action` supplies its own. */
    label?: string
    /** Gives the button a Tooltip saying this, or the body and side to show it on. */
    tooltip?: string | { body: string; placement?: 'top' | 'bottom' }
    /** Why the button is disabled, shown by its Tooltip. */
    disabledBody?: string
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    icon: undefined,
    trailingIcon: undefined,
    danger: false,
    selected: undefined,
    disabled: undefined,
    type: 'button',
    action: undefined,
    deps: undefined,
    label: undefined,
    tooltip: undefined,
    disabledBody: undefined,
  },
)

const { t } = useI18n()

const name = computed(() => props.label ?? props.action?.name(t.value) ?? '')
const iconName = computed(() => props.icon ?? props.action?.icon)
const isDisabled = computed(() => props.disabled ?? (props.action?.enabled ? !props.action.enabled(props.deps as never) : false))
const reason = computed(
  () => props.disabledBody ?? (props.action?.disabledBody && props.deps ? props.action.disabledBody(t.value, props.deps as never) : undefined),
)
const placement = computed(() => (typeof props.tooltip === 'object' ? props.tooltip.placement : undefined))

const tooltipProps = computed(() => {
  if (props.tooltip === undefined && !props.action && props.disabledBody === undefined) return undefined
  if (isDisabled.value) {
    return reason.value === undefined ? undefined : { name: name.value, disabled: true as const, disabledBody: reason.value, placement: placement.value, announce: false }
  }
  if (typeof props.tooltip === 'string') return { name: props.tooltip, placement: placement.value, announce: false }
  const body = typeof props.tooltip === 'object' ? props.tooltip.body : props.action?.body?.(t.value)
  return { name: name.value, hotkey: actionKey(props.action), body, placement: placement.value, announce: false }
})

const buttonAttrs = computed(() => ({
  class: ['ui-control', 'app-button', `app-button--${props.variant}`, `app-button--${props.size}`, { 'app-button--selected': props.selected, 'app-button--danger-link': props.danger }],
  type: props.type,
  'aria-pressed': props.selected === undefined ? undefined : props.selected,
  'aria-disabled': isDisabled.value ? true : undefined,
}))

/** A disabled button swallows the click before any listener the parent attached sees it. */
function swallowClick(event: MouseEvent) {
  if (!isDisabled.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <!-- Without a Tooltip the button is the root, so a parent's scoped styles on it still apply. -->
  <button v-if="!tooltipProps" v-bind="mergeProps(buttonAttrs, $attrs)" @click.capture="swallowClick">
    <AppIcon v-if="iconName" :name="iconName" :size="variant === 'link' ? 16 : 15" />
    <slot>{{ name }}</slot>
    <AppIcon v-if="trailingIcon" class="app-button__trailing" :name="trailingIcon" :size="15" />
  </button>
  <AppTooltip v-else v-bind="tooltipProps" class="app-button-wrap">
    <button v-bind="mergeProps(buttonAttrs, $attrs)" @click.capture="swallowClick">
      <AppIcon v-if="iconName" :name="iconName" :size="variant === 'link' ? 16 : 15" />
      <slot>{{ name }}</slot>
      <AppIcon v-if="trailingIcon" class="app-button__trailing" :name="trailingIcon" :size="15" />
    </button>
  </AppTooltip>
</template>

<style scoped>
.app-button-wrap {
  display: inline-flex;
}

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
  outline-offset: var(--focus-offset);
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

.app-button--link {
  gap: var(--space-6);
  height: auto;
  padding: 0;
  font: var(--type-control);
  background: none;
  border: 0;
  border-radius: var(--radius-xs);
  text-underline-offset: var(--link-underline-offset);
  transition: opacity var(--duration-instant) var(--ease-standard);
}

.app-button--danger-link {
  color: var(--danger);
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
  .app-button:hover:not([aria-disabled='true']) {
    background: var(--hover-fill);
  }

  .app-button--primary:hover:not([aria-disabled='true']) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .app-button--in-box:hover:not([aria-disabled='true']),
  .app-button--toolbox:hover:not([aria-disabled='true']) {
    background: var(--elevated);
    border-color: var(--ink);
  }

  .app-button--danger:hover:not([aria-disabled='true']) {
    background: var(--danger);
  }

  .app-button--selected:hover:not([aria-disabled='true']) {
    background: var(--ink);
  }

  .app-button--link:hover:not([aria-disabled='true']) {
    background: none;
    text-decoration: underline;
  }
}

.app-button:active:not([aria-disabled='true']) {
  background: var(--press-fill);
  transform: scale(var(--press-scale));
}

.app-button--primary:active:not([aria-disabled='true']) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.app-button--danger:active:not([aria-disabled='true']) {
  background: var(--danger);
}

.app-button--selected:active:not([aria-disabled='true']) {
  background: var(--ink);
}

.app-button--link:active:not([aria-disabled='true']) {
  background: none;
  opacity: 0.7;
  transform: none;
}

.app-button[aria-disabled='true'] {
  color: var(--faint);
  background: var(--surface);
  border-color: var(--line);
  cursor: not-allowed;
}

.app-button--primary[aria-disabled='true'] {
  color: var(--accent-disabled-fg);
  background: var(--accent-disabled-bg);
  border-color: var(--accent-disabled-bg);
}

.app-button--text[aria-disabled='true'],
.app-button--link[aria-disabled='true'] {
  background: none;
  border-color: transparent;
}

:root[data-theme='contrast'] .app-button:not(.app-button--link) {
  border-width: var(--border-emphasis);
}

/* High contrast keeps a pressed link at full strength and underlines it instead (accessibility.md). */
:root[data-theme='contrast'] .app-button--link:active:not([aria-disabled='true']) {
  opacity: 1;
  text-decoration: underline;
  text-decoration-thickness: var(--link-underline-thickness);
}

@media (prefers-reduced-motion: reduce) {
  .app-button:active:not([aria-disabled='true']) {
    transform: none;
  }
}
</style>
