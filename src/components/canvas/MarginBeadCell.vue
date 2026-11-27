<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useShellScope } from '../../composables/ui/shellScope'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { beadChoices, beadLabel, type Bead } from '../../domain/beads'
import { useI18n } from '../../i18n/useI18n'
import BeadSection from '../project/BeadSection.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'

/** Where this shell's popovers go: the app shell, or the Homepage demo's own box (ticket 0797). */
const teleportTo = useShellScope().teleportTo

// The Frame's Bead on the margin sheet's foot (tickets 1015, 1197, 1258; MarginSheet card): a chip of its label that
// opens Layer settings' Bead pickers in a popover, in the top layer so the sheet's scale never shrinks it. A pick only
// asks, as in the Frame panel: the shell confirms Replace Bead. Short of room, the label ends in an ellipsis.
const props = defineProps<{ bead: Bead }>()
const emit = defineEmits<{ pick: [beadId: string] }>()

const { t } = useI18n()
const choices = computed(() => beadChoices(props.bead))
/** The chip's name and Tooltip: Change, and the Bead whole, however short the label is cut. */
const changeName = computed(() => `${t.value.form.beadPicker.change}: ${beadLabel(props.bead)}`)

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

/** A pick closes the pickers and asks: the confirmation takes the focus from here. */
function pick(beadId: string): void {
  close(false)
  emit('pick', beadId)
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
  <span ref="rootEl" class="margin-bead" role="group" :aria-label="t.panels.project.bead" data-testid="margin-bead">
    <AppButton
      variant="text"
      class="margin-chip"
      :label="changeName"
      :aria-label="changeName"
      :tooltip="changeName"
      :expanded="open"
      aria-haspopup="dialog"
      data-testid="margin-bead-change"
      @click="open ? close() : show()"
    >
      <span class="margin-chip__text" data-testid="margin-bead-name">{{ beadLabel(bead) }}</span>
      <AppIcon name="pencil" :size="12" />
    </AppButton>
    <!-- In the app shell: inside the sheet's scale, Safari keeps a top-layer popup where it first showed. -->
    <Teleport v-if="open" :to="teleportTo">
      <div ref="popupEl" class="margin-bead__popover anchored-popup" popover="manual" :style="anchored.style.value" role="dialog" :aria-label="t.replaceBead.selectLabel" data-testid="margin-bead-popover">
        <span class="margin-bead__heading">{{ beadLabel(bead) }}</span>
        <BeadSection :bead="bead" :candidates="choices.candidates" :outdated="choices.outdated" @pick="pick" />
        <p class="margin-bead__hint">{{ t.form.beadPicker.hint }}</p>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.margin-bead,
.margin-bead :deep(.app-button-wrap) {
  display: flex;
  min-width: 0;
}

/* The shared popover look, as Margin color's: 12px padding, the overlay fill and line, elevation 3. */
.margin-bead__popover {
  position: fixed;
  z-index: var(--z-popover);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  width: var(--margin-bead-popover);
  padding: var(--space-12);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

:root[data-theme='contrast'] .margin-bead__popover {
  border-width: var(--border-emphasis);
  box-shadow: none;
}

.margin-bead__heading {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

/* The pickers fill the popover: the section's own inset is the panel's. */
.margin-bead__popover :deep(.bead-section) {
  padding: 0;
}

.margin-bead__hint {
  margin: 0;
  font: var(--type-small);
  color: var(--body);
}
</style>
