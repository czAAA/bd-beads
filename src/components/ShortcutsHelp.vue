<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useI18n } from '../i18n/useI18n'

/**
 * The `?` shortcuts help overlay (ticket 96): every keyboard shortcut from tickets 87, 88, 90, 91, 92, 93, 94, 95,
 * grouped under the same five Tool group names the Toolbox itself uses (CONTEXT.md's Tool group entry) -- Del
 * (ticket 90) and Space+drag (ticket 95) are canvas-wide rather than tied to a single button, and are grouped
 * under Tools as the closest fit; Paste (ticket 92) has no Toolbox button of its own, and sits under Edit next to
 * Copy. Key labels (digits, letters, "Ctrl/Cmd+C") are locale-neutral and written out directly here rather than
 * translated, matching the shortcut hints already appended to Toolbox tooltips.
 */
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const groups = computed(() => [
  {
    title: t.value.toolbox.groups.tools,
    shortcuts: [
      { keys: '1', label: t.value.tools.paintLabel },
      { keys: '2', label: t.value.tools.fillLabel },
      { keys: '3', label: t.value.tools.selectLabel },
      { keys: 'Del', label: t.value.shortcutsHelp.eraseOrClearSelection },
      { keys: 'Space + drag', label: t.value.shortcutsHelp.panCanvas },
    ],
  },
  {
    title: t.value.toolbox.groups.colors,
    shortcuts: [{ keys: 'Shift+1…9, Shift+0, Q, W', label: t.value.shortcutsHelp.paletteColors }],
  },
  {
    title: t.value.toolbox.groups.edit,
    shortcuts: [
      { keys: 'R', label: t.value.palette.rotateButton },
      { keys: 'Ctrl/Cmd+C', label: t.value.tools.copyButton },
      { keys: 'Ctrl/Cmd+V', label: t.value.tools.pasteLabel },
    ],
  },
  {
    title: t.value.toolbox.groups.mirror,
    shortcuts: [
      { keys: '−', label: t.value.mirror.decreaseLeftRightButton },
      { keys: '=', label: t.value.mirror.increaseLeftRightButton },
      { keys: '[', label: t.value.mirror.decreaseTopBottomButton },
      { keys: ']', label: t.value.mirror.increaseTopBottomButton },
      { keys: 'M', label: t.value.mirror.copyModeLabel },
      { keys: 'H', label: t.value.mirror.mirrorCurrentHorizontalButton },
      { keys: 'V', label: t.value.mirror.mirrorCurrentVerticalButton },
    ],
  },
  {
    title: t.value.toolbox.groups.rowProgress,
    shortcuts: [
      { keys: 'P', label: t.value.rowProgress.enabledLabel },
      { keys: 'D', label: t.value.rowProgress.directionButton },
      { keys: 'Enter', label: t.value.rowProgress.nextButton },
      { keys: 'Shift+Enter', label: t.value.rowProgress.previousButton },
    ],
  },
])

const titleId = useId()
const closeButtonEl = ref<HTMLButtonElement | null>(null)

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

// Bound to the window rather than the dialog itself, the same as ConfirmModal: nothing here takes keyboard focus
// reliably enough to rely on a local keydown handler.
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  closeButtonEl.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="shortcuts-help" data-testid="shortcuts-help-backdrop" @click.self="emit('close')">
    <div
      class="shortcuts-help__dialog"
      data-testid="shortcuts-help-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <div class="shortcuts-help__header">
        <h2 :id="titleId" class="shortcuts-help__title">{{ t.shortcutsHelp.title }}</h2>
        <button
          ref="closeButtonEl"
          type="button"
          class="icon-button"
          data-testid="shortcuts-help-close"
          :title="t.shortcutsHelp.closeButton"
          :aria-label="t.shortcutsHelp.closeButton"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 5l14 14M19 5 5 19" />
          </svg>
        </button>
      </div>

      <section
        v-for="group in groups"
        :key="group.title"
        class="shortcuts-help__group"
        data-testid="shortcuts-help-group"
      >
        <h3 class="shortcuts-help__group-title">{{ group.title }}</h3>
        <dl class="shortcuts-help__list">
          <template v-for="shortcut in group.shortcuts" :key="shortcut.keys">
            <dt class="shortcuts-help__keys">{{ shortcut.keys }}</dt>
            <dd class="shortcuts-help__label">{{ shortcut.label }}</dd>
          </template>
        </dl>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-help {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-ink) 55%, transparent);
}

.shortcuts-help__dialog {
  width: min(480px, 100%);
  max-height: min(640px, 100%);
  overflow-y: auto;
  padding: 24px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.shortcuts-help__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.shortcuts-help__title {
  margin: 0;
}

.shortcuts-help__group + .shortcuts-help__group {
  margin-top: 16px;
}

.shortcuts-help__group-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink);
  opacity: 0.55;
}

.shortcuts-help__list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0;
}

.shortcuts-help__keys {
  padding: 1px 6px;
  font-family: monospace;
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
  background: var(--color-paper);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}

.shortcuts-help__label {
  margin: 0;
  align-self: center;
}
</style>
