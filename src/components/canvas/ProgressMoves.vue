<script setup lang="ts">
import AppButton from '../ui/AppButton.vue'
import type { ControlActionLike } from '../ui/controlAction'
import type { IconName } from '../ui/icons'

// The Progress bar's back and forward pair (ProgressBar card, ticket 0788): Row not done and Row done in the editor, Back
// and Next on the Homepage and Convert image. One component, so the pair is the same size and look on every page: the
// quiet 32px `text` button back, the 32px primary forward; on a phone the two take a second row, half the bar each.
type Move = {
  label: string
  /** The back button's leading arrow. */
  icon?: IconName
  /** The forward button's trailing arrow; none where it ends the page in an act (Create Project). */
  trailingIcon?: IconName
  disabled?: boolean
  /** Why it is off, shown by its Tooltip; an `action` gives its own. */
  disabledBody?: string
  /** A registry action (ADR 0035): its Tooltip and key chip. */
  action?: ControlActionLike
  testid: string
}

defineProps<{ back: Move; forward: Move }>()
const emit = defineEmits<{ back: []; forward: [] }>()
</script>

<template>
  <span class="progress-moves">
    <AppButton
      variant="text"
      size="sm"
      :action="back.action"
      :icon="back.icon"
      :label="back.label"
      :disabled="back.disabled"
      :disabled-body="back.disabledBody"
      :data-testid="back.testid"
      @click="emit('back')"
    >
      {{ back.label }}
    </AppButton>
    <AppButton
      class="progress-moves__forward"
      variant="primary"
      size="sm"
      :action="forward.action"
      :trailing-icon="forward.trailingIcon"
      :label="forward.label"
      :disabled="forward.disabled"
      :disabled-body="forward.disabledBody"
      :data-testid="forward.testid"
      @click="emit('forward')"
    >
      {{ forward.label }}
    </AppButton>
  </span>
</template>

<style scoped>
.progress-moves {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

/* Phone widths (tickets 411, 556): the pair can't share a row with the rest in every language at 360px, so it takes a
 * second row, half the bar each, 4px apart with 6px side padding and 2px between icon and label, so the longest labels
 * fit at 320px. A button is wrapped (for its Tooltip) only while it has one, so a lone button is a flex item too. */
@media (max-width: 30rem) {
  .progress-moves {
    flex: 1 1 100%;
    min-width: 0;
    gap: var(--space-4);
  }

  .progress-moves > .app-button,
  .progress-moves :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .progress-moves :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-6);
    gap: var(--space-2);
    justify-content: center;
    font: var(--type-small);
  }
}
</style>
