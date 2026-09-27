<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useEscapeLayer } from '../composables/useEscapeLayer'

/**
 * The design system's Modal (ticket 76; Modal and ConfirmDialogs cards): a centered dialog over a scrim, 420px for a
 * confirmation or 560px for a panel (QR export, Keyboard shortcuts). The parent mounts it with `v-if` and decides what
 * cancelling means; Escape and the scrim both cancel. While open, focus stays inside: it starts on the control marked
 * `data-autofocus`, or the first one, Tab wraps around, and closing hands focus back to whatever opened it.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    title: string
    size?: 'confirm' | 'panel' | 'narrow'
    role?: 'dialog' | 'alertdialog'
    /** The id of the text that describes the dialog, for an alert dialog's message. */
    describedby?: string
    scrimTestid?: string
    /**
     * Where focus starts: the control marked data-autofocus, or the first one; or the dialog itself, for a panel that
     * is read rather than answered (Tab then reaches its controls), so its first button's tooltip doesn't pop up.
     */
    initialFocus?: 'control' | 'dialog'
  }>(),
  { size: 'confirm', role: 'dialog', describedby: undefined, scrimTestid: 'modal-scrim', initialFocus: 'control' },
)

const emit = defineEmits<{ cancel: [] }>()

const titleId = useId()
const dialogEl = ref<HTMLElement>()
let opener: HTMLElement | null = null

useEscapeLayer(() => true, () => emit('cancel'))

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(dialogEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const list = focusables()
  const first = list[0]
  const last = list.at(-1)
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialogEl.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/** Focus that leaves the dialog some other way (a click on the page behind, say) is brought back. */
function onFocusIn(event: FocusEvent) {
  const target = event.target as Node | null
  if (dialogEl.value && target && !dialogEl.value.contains(target)) {
    ;(focusables()[0] ?? dialogEl.value).focus()
  }
}

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const start =
    props.initialFocus === 'dialog'
      ? dialogEl.value
      : (dialogEl.value?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? dialogEl.value)
  start?.focus()
  document.addEventListener('focusin', onFocusIn)
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onFocusIn)
  const target = opener
  if (target?.isConnected) {
    target.focus()
  } else {
    void nextTick(() => target?.isConnected && target.focus())
  }
})
</script>

<template>
  <div class="app-modal-scrim" :data-testid="scrimTestid" @click.self="emit('cancel')">
    <div
      ref="dialogEl"
      class="app-modal"
      :class="`app-modal--${size}`"
      :role="role"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="describedby"
      tabindex="-1"
      v-bind="$attrs"
      @keydown="onKeydown"
    >
      <div class="app-modal__header">
        <h2 :id="titleId" class="app-modal__title">{{ title }}</h2>
        <slot name="header" />
      </div>
      <div class="app-modal__body">
        <slot />
      </div>
      <div v-if="$slots.actions" class="app-modal__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The scrim sits one step below the modal layer (StackingOrder card). */
.app-modal-scrim {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) - 1);
  display: grid;
  place-items: center;
  padding: var(--space-24);
  background: var(--scrim);
  animation: app-modal-fade var(--duration-base) var(--ease-out);
}

.app-modal {
  position: relative;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  width: var(--modal-width);
  max-width: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding: var(--space-24);
  font: var(--type-body);
  color: var(--body);
  background: var(--overlay-fill);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  animation: app-modal-arrive var(--duration-base) var(--ease-out);
}

.app-modal:focus {
  outline: none;
}

.app-modal--panel {
  width: var(--modal-width-panel);
}

.app-modal--narrow {
  width: var(--modal-width-narrow);
}

:root[data-theme='dark'] .app-modal {
  border: 1px solid var(--line-strong);
}

:root[data-theme='contrast'] .app-modal {
  border: 2px solid var(--line-strong);
  box-shadow: none;
}

.app-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-16);
}

.app-modal__title {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

.app-modal__body :deep(p) {
  margin: 0;
}

.app-modal__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-8);
  margin-top: var(--space-16);
}

@keyframes app-modal-fade {
  from {
    opacity: 0;
  }
}

@keyframes app-modal-arrive {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
}

/* Reduced motion: fade only, no scale (Motion card). */
@media (prefers-reduced-motion: reduce) {
  .app-modal {
    animation-name: app-modal-fade;
  }
}
</style>
