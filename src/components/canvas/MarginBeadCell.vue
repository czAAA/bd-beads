<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useShellScope } from '../../composables/ui/shellScope'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { beadChoices, beadLabel, type Bead } from '../../domain/beads'
import { useI18n } from '../../i18n/useI18n'
import BeadSection from '../project/BeadSection.vue'
import AppButton from '../ui/AppButton.vue'

/** Where this shell's popovers go: the app shell, or the Homepage demo's own box (ticket 0797). */
const teleportTo = useShellScope().teleportTo

// The Frame's Bead in the margin's roomy title block (ticket 1015, MarginSheet card): its name and a Change button
// that opens Layer settings' Bead pickers in a popover, in the top layer so the sheet's scale never shrinks it. A pick
// only asks, as in the Frame panel: the shell confirms Replace Bead.
const props = defineProps<{ bead: Bead }>()
const emit = defineEmits<{ pick: [beadId: string] }>()

const { t } = useI18n()
const choices = computed(() => beadChoices(props.bead))

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
    <span class="margin-bead__label" aria-hidden="true">{{ t.panels.project.bead }}</span>
    <span class="margin-bead__name" data-testid="margin-bead-name">{{ beadLabel(bead) }}</span>
    <AppButton
      variant="in-box"
      size="sm"
      :expanded="open"
      aria-haspopup="dialog"
      data-testid="margin-bead-change"
      @click="open ? close() : show()"
    >
      {{ t.form.beadPicker.change }}
    </AppButton>
    <!-- In the app shell: inside the sheet's scale, Safari keeps a top-layer popup where it first showed. -->
    <Teleport v-if="open" :to="teleportTo">
      <div ref="popupEl" class="margin-bead__popover anchored-popup" popover="manual" :style="anchored.style.value" role="dialog" :aria-label="t.replaceBead.selectLabel" data-testid="margin-bead-popover">
        <span class="margin-bead__heading">{{ t.panels.project.bead }}</span>
        <BeadSection :bead="bead" :candidates="choices.candidates" :outdated="choices.outdated" @pick="pick" />
        <p class="margin-bead__hint">{{ t.form.beadPicker.hint }}</p>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.margin-bead {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
  font: var(--type-small);
}

.margin-bead__label {
  font: var(--type-meta-small);
  color: var(--body);
}

/* Change is 24px, the least a button on the sheet is drawn at (MarginSheet card, Legible). */
.margin-bead :deep(.app-button) {
  height: var(--margin-tab);
  min-height: 0;
  padding: 0 var(--space-8);
  font: var(--type-small);
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
