<script setup lang="ts">
import { inTourCard } from '../../composables/ui/tourDom'
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import IconButton from '../ui/IconButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'

/**
 * The design system's ToolSheet (ticket 79; ToolSheet card): the phone Dock's bottom sheets. Light (the default --
 * Tool, Colour, Edit, Mirror, Size): `panel`, 18px top corners, a grab handle, title and close, no scrim, only as
 * tall as its content so the Project stays in view, and closes on a press anywhere outside it. `modal` (the Project
 * sheet): taller, with a scrim, closing only from its own controls or Escape -- an accidental tap past its edge
 * shouldn't lose the way back to New Project or Import.
 *
 * Mounted with `v-if`, like AppModal: while open, focus stays inside (Tab wraps, Escape and the close button hand it
 * back to whatever opened it). Slides up with `transform` (ADR 0018: the drawing surface behind it never resizes).
 * Swipe-to-dismiss (the card's other close gesture, alongside the close button, Escape, tapping the Project and the
 * Dock button re-toggling it) isn't built this pass -- see ticket 79's own note.
 */
const props = withDefaults(defineProps<{ title: string; modal?: boolean }>(), { modal: false })
const emit = defineEmits<{ close: [] }>()
const closeAction = controlAction('close')

const titleId = useId()
const sheetEl = ref<HTMLElement>()
const bodyEl = ref<HTMLElement>()
let opener: HTMLElement | null = null

useEscapeLayer(() => true, () => emit('close'))

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(sheetEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

/** Same, but for where opening focus lands: `data-skip-autofocus` (ticket 188) opts a control with a focus side
 * effect (SizeControls' info button opens its tooltip on focus) out of being that landing spot, while Tab still
 * reaches it normally through `focusables()`. */
function initialFocusable(within: HTMLElement | undefined = sheetEl.value): HTMLElement | undefined {
  return [...(within?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find((el) => !el.hasAttribute('data-skip-autofocus'))
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
  if (event.shiftKey && (active === first || active === sheetEl.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onFocusIn(event: FocusEvent) {
  const target = event.target as Node | null
  if (sheetEl.value && target && !sheetEl.value.contains(target) && !inTourCard(target)) {
    ;(initialFocusable() ?? focusables()[0] ?? sheetEl.value)?.focus()
  }
}

/** A light sheet closes on a press anywhere outside it -- "tapping the Project" is one case of this, not a special one. */
function onPointerDownOutside(event: PointerEvent) {
  if (props.modal) return
  if (sheetEl.value && !sheetEl.value.contains(event.target as Node) && !inTourCard(event.target)) emit('close')
}

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  // The close button sits before the body in DOM order (so it can stay pinned top-right); focus starts on the
  // sheet's own content instead, the same way AppModal's own initial focus skips past its header.
  void nextTick(() => (initialFocusable(bodyEl.value) ?? initialFocusable() ?? focusables()[0] ?? sheetEl.value)?.focus())
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('pointerdown', onPointerDownOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('pointerdown', onPointerDownOutside)
  const target = opener
  if (target?.isConnected) {
    target.focus()
  } else {
    void nextTick(() => target?.isConnected && target.focus())
  }
})
</script>

<template>
  <div v-if="modal" class="bottom-sheet-scrim" data-testid="sheet-scrim" />
  <div
    ref="sheetEl"
    class="bottom-sheet"
    :class="{ 'bottom-sheet--modal': modal }"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    tabindex="-1"
    data-testid="bottom-sheet"
    @keydown="onKeydown"
  >
    <div class="bottom-sheet__handle" aria-hidden="true" />
    <div class="bottom-sheet__head">
      <h2 :id="titleId" class="bottom-sheet__title">{{ title }}</h2>
      <div class="bottom-sheet__head-actions">
        <slot name="actions" />
        <IconButton variant="plain" shape="round" :icon-size="16" :action="closeAction" data-testid="sheet-close" @click="emit('close')" />
      </div>
    </div>
    <div ref="bodyEl" class="bottom-sheet__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet-scrim {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-sheet) - 1);
  background: var(--scrim);
  animation: bottom-sheet-fade var(--duration-base) var(--ease-out);
  pointer-events: none;
}

.bottom-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--z-sheet);
  box-sizing: border-box;
  max-height: 80dvh;
  padding: var(--space-8) var(--space-20) calc(var(--space-20) + env(safe-area-inset-bottom));
  overflow-y: auto;
  overscroll-behavior: none;
  background: var(--panel);
  border-top: 1px solid var(--panel-line);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--elevation-3);
  animation: bottom-sheet-arrive var(--duration-base) var(--ease-out);
}

.bottom-sheet--modal {
  max-height: 90dvh;
  background: var(--overlay-fill);
}

.bottom-sheet:focus {
  outline: none;
}

:root[data-theme='dark'] .bottom-sheet {
  border-color: var(--line-strong);
}

:root[data-theme='contrast'] .bottom-sheet {
  border-width: 2px;
  box-shadow: none;
}

.bottom-sheet__handle {
  width: 2.25rem;
  height: 4px;
  margin: 0 auto var(--space-12);
  background: var(--line-strong);
  border-radius: var(--radius-full);
}

.bottom-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
  margin-bottom: var(--space-12);
}

.bottom-sheet__head-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-4);
}

.bottom-sheet__title {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

@keyframes bottom-sheet-fade {
  from {
    opacity: 0;
  }
}

@keyframes bottom-sheet-arrive {
  from {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet,
  .bottom-sheet-scrim {
    animation: none;
  }
}
</style>
