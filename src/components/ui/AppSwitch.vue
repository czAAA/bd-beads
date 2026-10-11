<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppTooltip from './AppTooltip.vue'
import { actionKey, type ControlActionLike } from './controlAction'

/**
 * An on/off switch (tickets 144, 339; ProgressBar and SwitchAndFileButton cards): a 30 × 18 track with a 12px knob,
 * `role="switch"`, named by `label` or by its registry `action`. On is the accent track with the knob at the right;
 * off is a quiet track with a white knob at the left. `v-model` holds whether it is on.
 *
 * Like the other shared controls (ADR 0035) it shows a Tooltip exactly when it is given an `action`, whose name, key
 * chip, enabled state (`deps` is what it reads) and disabled reason it takes. A disabled switch is `aria-disabled`, so
 * it stays hoverable and focusable and a click does nothing. Attributes go to the <button> itself.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ label?: string; disabled?: boolean; action?: ControlActionLike; deps?: unknown }>(), {
  label: undefined,
  disabled: undefined,
  action: undefined,
  deps: undefined,
})
const on = defineModel<boolean>({ required: true })

const { t } = useI18n()

const name = computed(() => props.label ?? props.action?.name(t.value) ?? '')
const isDisabled = computed(() => props.disabled ?? (props.action?.enabled ? !props.action.enabled(props.deps as never) : false))
const tooltipProps = computed(() => {
  if (!props.action) return undefined
  if (isDisabled.value) {
    const reason = props.action.disabledBody && props.deps ? props.action.disabledBody(t.value, props.deps as never) : undefined
    return reason === undefined ? undefined : { name: name.value, disabled: true as const, disabledBody: reason, announce: false }
  }
  return { name: name.value, hotkey: actionKey(props.action), body: props.action.body?.(t.value), announce: false }
})

function toggle() {
  if (!isDisabled.value) on.value = !on.value
}
</script>

<template>
  <component :is="tooltipProps ? AppTooltip : 'span'" v-bind="tooltipProps ?? {}" class="app-switch-wrap">
    <button
      class="ui-control app-switch"
      type="button"
      role="switch"
      :aria-checked="on"
      :aria-label="name"
      :aria-disabled="isDisabled ? 'true' : undefined"
      v-bind="$attrs"
      @click="toggle"
    >
      <span class="app-switch__knob" />
    </button>
  </component>
</template>

<style scoped>
.app-switch {
  position: relative;
  flex: none;
  width: var(--switch-width);
  height: var(--switch-height);
  padding: 0;
  background: var(--switch-off);
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.app-switch__knob {
  position: absolute;
  top: calc((var(--switch-height) - var(--switch-knob)) / 2);
  left: calc((var(--switch-height) - var(--switch-knob)) / 2);
  width: var(--switch-knob);
  height: var(--switch-knob);
  background: var(--canvas);
  border-radius: var(--radius-full);
  transition: transform var(--duration-fast) var(--ease-standard);
}

:root[data-theme='dark'] .app-switch__knob {
  background: var(--ink);
}

.app-switch[aria-checked='true'] {
  background: var(--accent);
}

.app-switch[aria-checked='true'] .app-switch__knob {
  background: var(--on-accent);
  transform: translateX(calc(var(--switch-width) - var(--switch-height)));
}

.app-switch:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.app-switch-wrap {
  display: inline-flex;
  flex: none;
}

.app-switch[aria-disabled='true'] {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  .app-switch__knob {
    transition: none;
  }
}
</style>
