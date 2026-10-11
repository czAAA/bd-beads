<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import MenuButton from '../ui/MenuButton.vue'
import ImageColorsPicker from './ImageColorsPicker.vue'

/**
 * The Image colors button (ticket 151; ColorPickers card): a MenuButton that opens a popover under it with the colors
 * Convert image found as a 7-column grid. Choosing one, Escape or a press outside closes it, and Escape hands focus
 * back to the button. A Project with no Image colors leaves the button `faint`, saying why in its Tooltip; it stays
 * focusable so that reason can be read.
 */
const props = defineProps<{
  colors?: readonly string[]
  selectedColor?: string
}>()

const emit = defineEmits<{ select: [hex: string] }>()
const { t } = useI18n()

const menu = ref<InstanceType<typeof MenuButton>>()
const rootEl = ref<HTMLElement>()

/** Focus goes to the color being painted with, else the first (MenuButton's own first-item focus is for menus). */
async function onOpen() {
  // MenuButton focuses its first item after one tick (a keyboard open); this goes after it.
  await nextTick()
  await nextTick()
  const swatches = rootEl.value?.querySelectorAll<HTMLElement>('[data-testid="image-color-swatch"]')
  ;([...(swatches ?? [])].find((swatch) => swatch.getAttribute('aria-pressed') === 'true') ?? swatches?.[0])?.focus()
}

function onSelect(hex: string) {
  emit('select', hex)
  menu.value?.close()
}
</script>

<template>
  <div ref="rootEl" class="image-colors-button">
    <MenuButton
      ref="menu"
      popover
      align="end"
      variant="toolbox"
      icon="image"
      :label="t.convertImage.imageColorsShort"
      :disabled="!props.colors?.length"
      :disabled-body="t.tooltips.imageColorsDisabled"
      data-testid="image-colors-button"
      @open="onOpen"
    >
      <ImageColorsPicker :colors="props.colors ?? []" :selected-color="selectedColor" @select="onSelect" />
    </MenuButton>
  </div>
</template>

<style scoped>
.image-colors-button {
  display: flex;
  flex: 1 1 auto;
  min-width: max-content;
}

.image-colors-button :deep(.menu-button),
.image-colors-button :deep(.app-tooltip) {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.image-colors-button :deep(.app-button) {
  flex: 1 1 auto;
  justify-content: center;
}
</style>
