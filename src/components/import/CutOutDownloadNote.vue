<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { megabytes } from '../../domain/cutOutModel'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'

/** The download note (ConvertImage card, tickets 0767, 0768): says it runs on the device, uploads nothing and downloads
 * its size once, with a line for low memory or free space, Download (AI-marked) and Cancel; with nothing to download,
 * it asks once more after a stopped run, with Try again. Focus goes to its first button. */
const props = defineProps<{ bytes: number; lowMemory: boolean; lowSpace: boolean }>()
const emit = defineEmits<{ download: []; cancel: [] }>()

const { t } = useI18n()
const words = computed(() => t.value.convertImage.wizard.cutOut)
const text = computed(() =>
  props.bytes > 0 ? fillBlanks(words.value.downloadNote, { size: fillBlanks(words.value.downloadSize, { n: megabytes(props.bytes) }) }) : words.value.askAgain,
)

const noteEl = ref<HTMLElement>()
onMounted(() => noteEl.value?.querySelector<HTMLButtonElement>('[data-testid="cut-out-download"]')?.focus())
</script>

<template>
  <div ref="noteEl" class="cut-out-note" data-testid="cut-out-download-note">
    <p class="cut-out-note__text">{{ text }}</p>
    <p v-if="lowMemory" class="cut-out-note__text cut-out-note__warning" data-testid="cut-out-low-memory">{{ words.lowMemory }}</p>
    <p v-if="lowSpace" class="cut-out-note__text cut-out-note__warning" data-testid="cut-out-low-space">{{ words.lowSpace }}</p>
    <div class="cut-out-note__buttons">
      <AppButton variant="in-box" size="sm" icon="cut-out-ai" data-testid="cut-out-download" @click="emit('download')">{{
        bytes > 0 ? words.download : words.tryAgain
      }}</AppButton>
      <AppButton variant="text" size="sm" data-testid="cut-out-download-cancel" @click="emit('cancel')">{{ words.cancel }}</AppButton>
    </div>
  </div>
</template>

<style scoped>
/* Like a Note (Note card), here with buttons, as it asks before a download. */
.cut-out-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  padding: var(--space-8) var(--space-10);
  background: var(--surface);
  border-radius: var(--radius-sm);
}

.cut-out-note__text {
  margin: 0;
  font: var(--type-meta);
  color: var(--muted);
  overflow-wrap: anywhere;
}

/* A check's warning reads a step stronger than the note (ConvertImage card, the download note). */
.cut-out-note__warning {
  color: var(--body);
}

.cut-out-note__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}
</style>
