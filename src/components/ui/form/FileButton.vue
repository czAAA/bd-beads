<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import type { IconName } from '../icons'

/**
 * A button that opens the system file picker (ticket 149; SwitchAndFileButton card): 40px, a dashed border saying
 * "a file goes here", and on desktop a file can be dropped on it too. The limits are always written under it; while
 * it is off, the reason is written there as well. The <input> keeps the attributes (id, accept, data-testid) and the
 * change listener; a dropped file arrives as `drop-file`.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ label: string; icon?: IconName; disabled?: boolean; disabledReason?: string; limits?: string }>()
const emit = defineEmits<{ 'drop-file': [file: File] }>()

const dragging = ref(false)

function onDrop(event: DragEvent, disabled: boolean | undefined) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && !disabled) emit('drop-file', file)
}
</script>

<template>
  <div class="file-button">
    <label
      class="file-button__target"
      :class="{ 'file-button__target--disabled': disabled, 'file-button__target--over': dragging }"
      @dragover.prevent="dragging = !disabled"
      @dragleave="dragging = false"
      @drop.prevent="onDrop($event, disabled)"
    >
      <input class="file-button__input" type="file" :disabled="disabled" v-bind="$attrs" />
      <AppIcon v-if="icon" :name="icon" :size="16" />
      <span>{{ label }}</span>
    </label>
    <p v-if="disabled && disabledReason" class="file-button__note">{{ disabledReason }}</p>
    <p v-if="limits" class="file-button__note" data-testid="file-button-limits">{{ limits }}</p>
  </div>
</template>

<style scoped>
.file-button {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.file-button__target {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  box-sizing: border-box;
  height: var(--field-height);
  margin: 0;
  padding: 0 var(--space-12);
  font: var(--type-control);
  color: var(--ink);
  background: var(--elevated);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

@media (hover: hover) {
  .file-button__target:hover:not(.file-button__target--disabled) {
    border-color: var(--ink);
  }
}

.file-button__target--over {
  background: var(--hover-fill);
  border-color: var(--ink);
}

.file-button__target:has(:focus-visible) {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.file-button__target--disabled {
  color: var(--faint);
  background: var(--surface);
  cursor: not-allowed;
}

/* Visually hidden, not display: none, so it stays focusable and reachable by keyboard and screen reader. */
.file-button__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.file-button__note {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

:root[data-theme='contrast'] .file-button__target {
  border-width: 2px;
}
</style>
