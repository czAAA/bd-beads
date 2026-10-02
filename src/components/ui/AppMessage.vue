<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

/**
 * The design system's Message (ticket 76; Message card): a notice or a toast. A 3px edge and a 16px icon in its tone
 * (`accent` for a result or information, `warning`, or `danger`), the text, optional text-button actions, and a close ×.
 * `placement` picks the frame: `toast` floats with elevation 3, `notice` fills the notice row under the header at
 * elevation 0. With a `timeout` it goes by itself, but never while hovered or focused: the clock starts again once it
 * is left. Errors (`danger`) are announced at once and are given no timeout by their callers.
 */
const props = withDefaults(
  defineProps<{
    tone?: 'success' | 'info' | 'warning' | 'danger'
    placement?: 'toast' | 'notice'
    closable?: boolean
    timeout?: number
  }>(),
  { tone: 'success', placement: 'toast', closable: true, timeout: undefined },
)

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const ICONS: Record<NonNullable<typeof props.tone>, IconName> = {
  success: 'check',
  info: 'info',
  warning: 'warning',
  danger: 'warning',
}
const icon = computed(() => ICONS[props.tone])

let timer: ReturnType<typeof setTimeout> | undefined
let hovered = false
let focused = false

function startClock() {
  clearTimeout(timer)
  if (props.timeout !== undefined && !hovered && !focused) {
    timer = setTimeout(() => emit('close'), props.timeout)
  }
}

function hold(kind: 'hover' | 'focus', on: boolean) {
  if (kind === 'hover') hovered = on
  else focused = on
  if (on) clearTimeout(timer)
  else startClock()
}

onMounted(startClock)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    class="app-message"
    :class="[`app-message--${tone}`, `app-message--${placement}`]"
    :role="tone === 'danger' ? 'alert' : 'status'"
    @pointerenter="hold('hover', true)"
    @pointerleave="hold('hover', false)"
    @focusin="hold('focus', true)"
    @focusout="hold('focus', false)"
  >
    <AppIcon class="app-message__icon" :name="icon" :size="16" />
    <span class="app-message__text"><slot /></span>
    <span v-if="$slots.actions" class="app-message__actions"><slot name="actions" /></span>
    <button
      v-if="closable"
      class="ui-control app-message__close"
      type="button"
      :aria-label="t.a11y.closeMessage"
      data-testid="message-close"
      @click="emit('close')"
    >
      <AppIcon name="close" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.app-message {
  display: flex;
  align-items: flex-start;
  gap: var(--space-10);
  box-sizing: border-box;
  padding: var(--space-12) var(--space-16);
  font: var(--type-body);
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: var(--tone-edge) solid var(--accent-strong);
  border-radius: var(--radius-lg);
}

:root[data-theme='dark'] .app-message {
  background: var(--elevated);
  border-color: var(--line-strong);
  border-left-color: var(--accent-strong);
}

:root[data-theme='contrast'] .app-message {
  background: var(--canvas);
  border-width: 2px;
  border-color: var(--line-strong);
  border-left: var(--tone-edge) solid var(--accent-strong);
}

.app-message--toast {
  max-width: var(--message-max-width);
  box-shadow: var(--elevation-3);
}

:root[data-theme='contrast'] .app-message--toast {
  box-shadow: none;
}

.app-message__icon {
  margin-top: var(--space-2);
  color: var(--accent-strong);
}

.app-message.app-message--warning {
  border-left-color: var(--warning);
}

.app-message--warning .app-message__icon {
  color: var(--warning);
}

.app-message.app-message--danger {
  border-left-color: var(--danger);
}

.app-message--danger .app-message__icon {
  color: var(--danger);
}

.app-message__text {
  flex: 1 1 auto;
  min-width: 0;
}

.app-message__actions {
  display: flex;
  flex: none;
  gap: var(--space-8);
  align-items: center;
}

.app-message__close {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--message-close-size);
  height: var(--message-close-size);
  margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-8)) calc(-1 * var(--space-4)) 0;
  padding: 0;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

@media (hover: hover) {
  .app-message__close:hover {
    background: var(--hover-fill);
  }
}

.app-message__close:active {
  background: var(--press-fill);
}

.app-message__close:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
