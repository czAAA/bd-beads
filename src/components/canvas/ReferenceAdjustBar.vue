<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { imageInputAccept } from '../../domain/imageConversion'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import FileButton from '../ui/form/FileButton.vue'
import IconButton from '../ui/IconButton.vue'

// The Adjust bar (ReferenceImage card, tickets 0790, 0799): over the Tool pill's place while the reference image is
// adjusted, the label, Replace image, Fit to Canvas and Done; on a phone Replace image as an icon, Fit and Done, 44px tall.
const emit = defineEmits<{
  /** A file picked by Replace image, the Project panel's pick. */
  replace: [file: File]
  fit: []
  done: []
}>()

const { t } = useI18n()
const words = computed(() => t.value.referenceImage)
const phone = useMediaQuery('(max-width: 743px)')

const accept = imageInputAccept()
const pickerEl = ref<HTMLElement>()
/** Replace image opens the picker of the file input kept in the bar. */
const choose = () => pickerEl.value?.querySelector<HTMLInputElement>('input[type="file"]')?.click()

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('replace', file)
  // Picking the same file again still counts as a change.
  input.value = ''
}
</script>

<template>
  <div class="reference-adjust-bar" data-testid="reference-adjust-bar">
    <span v-if="!phone" class="reference-adjust-bar__label">{{ words.section }}</span>
    <IconButton v-if="phone" icon="image" variant="secondary" size="lg" shape="round" :label="words.replace" tooltip data-testid="reference-adjust-replace" @click="choose" />
    <AppButton v-else icon="image" data-testid="reference-adjust-replace" @click="choose">{{ words.replace }}</AppButton>
    <span ref="pickerEl" hidden>
      <FileButton :label="words.replace" :accept="accept" tabindex="-1" data-testid="reference-adjust-replace-input" @change="onFile" />
    </span>
    <AppButton icon="reset" data-testid="reference-adjust-fit" @click="emit('fit')">{{ phone ? words.fitShort : words.fit }}</AppButton>
    <AppButton variant="primary" icon="check" data-testid="reference-adjust-done" @click="emit('done')">{{ words.done }}</AppButton>
  </div>
</template>

<style scoped>
.reference-adjust-bar {
  position: absolute;
  bottom: var(--reference-bar-bottom);
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-6) var(--space-6) var(--space-6) var(--space-16);
  background: var(--canvas);
  border: 1px solid var(--box-line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-3);
  transform: translateX(-50%);
  animation: reference-adjust-bar-in var(--duration-fast) var(--ease-standard);
}

.reference-adjust-bar__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
  white-space: nowrap;
}

@media (max-width: 743px) {
  .reference-adjust-bar {
    padding-left: var(--space-6);
  }

  .reference-adjust-bar :deep(.app-button) {
    height: var(--touch-target);
  }
}

@keyframes reference-adjust-bar-in {
  from {
    opacity: 0;
  }
}
</style>
