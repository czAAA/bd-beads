<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatImageLimits } from '../../domain/imageConversion'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'

// A picture dropped or pasted anywhere on the app opens Convert image with it set (spec 0645; ConvertImage card): while
// one is dragged over, the scrim and a centred card in the drop look. Only pictures: a Project file dropped on Import,
// or a drop a control has taken, is left alone, and nothing happens while a dialog is showing.
const props = defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ picture: [file: File] }>()

const { t } = useI18n()
const over = ref(false)
const limits = computed(() => formatImageLimits(t.value.convertImage.wizard.dropLimits))

const carriesPicture = (transfer: DataTransfer | null) => [...(transfer?.items ?? [])].some((item) => item.kind === 'file' && item.type.startsWith('image/'))
const pictureIn = (transfer: DataTransfer | null) => [...(transfer?.files ?? [])].find((file) => file.type.startsWith('image/'))

function onDragOver(event: DragEvent) {
  if (props.disabled || !carriesPicture(event.dataTransfer)) return
  event.preventDefault()
  over.value = true
}

function onDragLeave(event: DragEvent) {
  // Leaving the window, not moving from one element to another.
  if (!event.relatedTarget) over.value = false
}

function onDrop(event: DragEvent) {
  over.value = false
  if (props.disabled || event.defaultPrevented) return
  const file = pictureIn(event.dataTransfer)
  if (!file) return
  event.preventDefault()
  emit('picture', file)
}

function onPaste(event: ClipboardEvent) {
  if (props.disabled || event.defaultPrevented) return
  const file = pictureIn(event.clipboardData)
  if (!file) return
  event.preventDefault()
  emit('picture', file)
}

onMounted(() => {
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  document.addEventListener('paste', onPaste)
})
onBeforeUnmount(() => {
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  document.removeEventListener('paste', onPaste)
})
</script>

<template>
  <div v-if="over && !disabled" class="picture-drop" data-testid="picture-drop-overlay">
    <div class="picture-drop__card">
      <AppIcon name="image" :size="34" />
      <span class="picture-drop__title">{{ t.convertImage.wizard.dropToConvert }}</span>
      <span class="picture-drop__limits">{{ limits }}</span>
    </div>
  </div>
</template>

<style scoped>
.picture-drop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) - 1);
  display: grid;
  place-items: center;
  pointer-events: none;
  background: var(--scrim);
}

.picture-drop__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  box-sizing: border-box;
  width: min(var(--picture-drop-width), calc(100% - var(--space-32)));
  height: var(--picture-drop-height);
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 2px dashed var(--accent-strong);
  border-radius: var(--radius-lg);
}

.picture-drop__title {
  font: var(--type-control);
}

.picture-drop__limits {
  font: var(--type-meta);
  color: var(--muted);
}
</style>
