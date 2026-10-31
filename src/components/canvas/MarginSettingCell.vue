<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { fillBlanks } from '../../domain/fillBlanks'
import type { SettingSpec } from '../../domain/settingSpec'
import { weaveSettingWords } from '../../i18n/settingWords'
import { useI18n } from '../../i18n/useI18n'
import SettingStepper from '../project/SettingStepper.vue'
import IconButton from '../ui/IconButton.vue'
import { settingTestid } from '../project/settingTestid'

// One Technique setting in the margin's title block (ticket 0698), drawn from its description like the panels' steppers,
// never named per Technique: its value in short ("2-drop") and a pencil that opens the panels' stepper in a popover,
// in the top layer so the sheet's scale never shrinks it. Each step applies at once; Escape or a press outside closes it.
const props = defineProps<{
  setting: SettingSpec
  value: number
  /** Whether the full form edits it: compact, it is read only. */
  editable: boolean
  /** Its reason while a pass is done and the setting is locked. */
  disabledBody?: string
}>()
const emit = defineEmits<{ set: [value: number] }>()

const { t } = useI18n()
const words = computed(() => weaveSettingWords(t.value, props.setting))
const testid = computed(() => settingTestid('margin', props.setting))

const open = ref(false)
const rootEl = ref<HTMLElement>()
const popupEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(rootEl, popupEl, () => 'start', () => 'above')

async function show(): Promise<void> {
  open.value = true
  await nextTick()
  anchored.follow()
  popupEl.value?.querySelector<HTMLElement>('button:not([aria-disabled="true"])')?.focus({ preventScroll: true })
}

function close(returnFocus = true): void {
  if (!open.value) return
  open.value = false
  anchored.stop()
  if (returnFocus) rootEl.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
}

useOverlayLayer({
  isOpen: () => open.value,
  root: () => popupEl.value,
  close: () => close(),
  onOutsidePress: () => close(false),
  isOpener: (target) => rootEl.value?.contains(target) ?? false,
})
</script>

<template>
  <span ref="rootEl" class="margin-setting" :data-testid="testid">
    <span class="margin-setting__value" :data-testid="`${testid}-short`">{{ fillBlanks(words.short, { count: value }) }}</span>
    <IconButton
      v-if="editable"
      variant="plain"
      icon="pencil"
      :icon-size="12"
      :label="fillBlanks(t.frame.margin.changeSetting, { setting: words.label })"
      :tooltip="{ body: words.body }"
      :disabled="disabledBody !== undefined"
      :disabled-body="disabledBody"
      :selected="open"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :data-testid="`${testid}-edit`"
      @click="open ? close() : show()"
    />
    <!-- In the app shell: inside the sheet's scale, Safari keeps a top-layer popup where it first showed. -->
    <Teleport v-if="open" to=".app-shell">
      <div ref="popupEl" class="margin-setting__popover anchored-popup" popover="manual" :style="anchored.style.value" role="dialog" :aria-label="words.label" :data-testid="`${testid}-popover`">
        <SettingStepper :setting="setting" :model-value="value" :testid="`${testid}-stepper`" @update:model-value="emit('set', $event)" />
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.margin-setting {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

/* The pencil as the name's and the maker's: 18px, `body`, a 12px icon (MarginSheet card). */
.margin-setting :deep(.icon-btn) {
  width: var(--margin-pencil);
  height: var(--margin-pencil);
  color: var(--body);
}

/* The shared popover look, as Margin color's: 12px padding, the overlay fill and line, elevation 3. */
.margin-setting__popover {
  position: fixed;
  z-index: var(--z-popover);
  box-sizing: border-box;
  padding: var(--space-12);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

:root[data-theme='contrast'] .margin-setting__popover {
  border-width: var(--border-emphasis);
  box-shadow: none;
}
</style>
