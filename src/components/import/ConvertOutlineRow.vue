<script setup lang="ts">
import { computed, nextTick, provide, ref } from 'vue'
import { provideBeadColors } from '../../composables/palette/useBeadColors'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { providePalette } from '../../composables/tools/usePalette'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import type { TargetColor } from '../../domain/convertColors'
import { colorLabel } from '../../i18n/colorLabel'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppSwatch from '../ui/AppSwatch.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import { PICK_CLOSE } from '../shell/pickContext'
import ColorPopoverBody from '../tools/ColorPopoverBody.vue'
import { labelledColorOf, paletteTarget, pickerBeadColors } from './convertPicker'

// Convert image's Outline (ConvertImage card, 4 Colors; ticket 0766): the switch, and the Outline's color as a swatch
// that opens the colour popover's body in the step, as a found color's Change does; Darkest in its head goes back to
// the darkest found color. Shown by the step only while there are empty beads round the subject.
const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const actions = { outline: controlAction('subject-outline') }
const rowEl = ref<HTMLElement>()
const swatchEl = ref<InstanceType<typeof AppSwatch>>()
const open = ref(false)

const color = computed(() => wizard.outlineColor.value)
const name = computed(() => (color.value ? colorLabel(t.value, labelledColorOf(color.value), wizard.catalog.value).text : ''))
const on = computed({ get: () => wizard.outline.value, set: (next: boolean) => wizard.setOutline(next) })
const selectedColorId = computed(() => (color.value ? wizard.remapPalette.value.byHex(color.value.hex)?.id : undefined))

function choose(target: TargetColor) {
  wizard.setOutlineColor(target)
}

function pickSwatch(colorId: string) {
  const target = paletteTarget(wizard, colorId)
  if (target) choose(target)
}

async function close() {
  if (!open.value) return
  open.value = false
  await nextTick()
  ;(swatchEl.value?.$el as HTMLElement | undefined)?.querySelector('button')?.focus()
}

// As a found color's picker: a layer of its own, so Escape closes it first; a press elsewhere goes through.
provide(PICK_CLOSE, () => {})
providePalette(wizard.remapPalette)
provideBeadColors(pickerBeadColors(wizard, choose))
useOverlayLayer({ isOpen: () => open.value, root: () => rowEl.value, close: () => void close(), keepsPress: () => true })
</script>

<template>
  <div ref="rowEl" class="convert-outline" :class="{ 'convert-outline--open': open }" data-testid="convert-outline">
    <div class="convert-outline__row">
      <span class="convert-outline__label">{{ words.helpers.outline }}</span>
      <AppSwatch
        v-if="color"
        ref="swatchEl"
        :color="color.hex"
        :label="`${words.helpers.outlineColor}, ${name}`"
        :tooltip-name="words.helpers.outlineColor"
        :selected="open"
        :aria-expanded="open"
        data-testid="convert-outline-color"
        @select="open = !open"
      />
      <AppSwitch v-model="on" :action="actions.outline" data-testid="convert-outline-switch" />
    </div>

    <div v-if="open && color" class="convert-outline__picker" data-testid="convert-outline-picker">
      <ColorPopoverBody
        :color-hex="color.hex"
        :color-name="name"
        :selected-color-id="selectedColorId"
        :custom-color="color.hex"
        :palette-label="words.newPalette"
        :editable="false"
        @close="close"
        @select-color="pickSwatch"
        @select-custom-color="(hex) => choose({ hex })"
      >
        <template #head>
          <AppButton
            variant="in-box"
            size="sm"
            :selected="!wizard.outlineColorPicked.value"
            :aria-pressed="!wizard.outlineColorPicked.value"
            data-testid="convert-outline-darkest"
            @click="wizard.setOutlineColor(undefined)"
          >
            {{ words.helpers.darkest }}
          </AppButton>
        </template>
      </ColorPopoverBody>
    </div>
  </div>
</template>

<style scoped>
.convert-outline--open {
  background: var(--surface);
  border-radius: var(--radius-md);
}

:root[data-theme='dark'] .convert-outline--open {
  background: var(--elevated);
}

:root[data-theme='contrast'] .convert-outline--open {
  border: 2px solid var(--line);
}

.convert-outline__row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.convert-outline__label {
  flex: 1 1 auto;
  min-width: 0;
  font: var(--type-control);
  color: var(--ink);
}

.convert-outline__picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding: var(--space-4) var(--space-10) var(--space-12);
}
</style>
