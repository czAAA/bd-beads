<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { catalogSwatches } from '../../domain/beadSwatch'
import { fillBlanks } from '../../domain/fillBlanks'
import { formFactorName } from '../../domain/beads'
import { brandColors } from '../../domain/palette'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import InfoButton from '../ui/InfoButton.vue'
import MyBeadsPicker from '../palette/MyBeadsPicker.vue'

// The Colors popover's My beads view (ConvertImage card DS-2, tickets 0902, 0903): the same box turned to the list of
// codes the person owns in the Bead's Color catalog, its picker under the head. Back, or Escape, returns to the Colors
// view; ⌘V anywhere in it outside a text field adds the clipboard's codes.
const emit = defineEmits<{ back: [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.myBeads)
const rootEl = ref<HTMLElement>()
const picker = ref<InstanceType<typeof MyBeadsPicker>>()

const listed = computed(() => wizard.myBeadsCodes.value.length)
const countText = computed(() => (listed.value > 0 ? plural(locale.value, listed.value, words.value.codes) : words.value.noCodes))
const catalogLine = computed(() => {
  const { brand, formFactor } = wizard.bead.value
  return fillBlanks(words.value.catalog, { catalog: `${brand.name} ${formFactorName(formFactor)}`.toLocaleLowerCase(locale.value) })
})
/** The Bead's codes in its size, discontinued ones too, so the list can grey them. */
const swatches = computed(() => {
  const catalog = wizard.beadCatalog.value
  const bead = wizard.bead.value
  return catalog ? catalogSwatches(catalog, bead.size, [], brandColors(bead.brand.id)) : []
})

// The view is a layer over the Colors popover: Escape comes back to Colors; a press outside closes the popover.
useOverlayLayer({ isOpen: () => true, root: () => rootEl.value, close: () => emit('back'), onOutsidePress: () => wizard.closePopover() })
onMounted(() => rootEl.value?.querySelector<HTMLElement>('[data-testid="convert-my-beads-back"]')?.focus({ preventScroll: true }))
</script>

<template>
  <div ref="rootEl" class="my-beads" data-testid="convert-my-beads" @paste="picker?.onPaste($event)">
    <div class="my-beads__head">
      <IconButton icon="arrow-left" variant="plain" :label="words.back" data-testid="convert-my-beads-back" @click="emit('back')" />
      <span class="my-beads__title">
        {{ words.name }}
        <InfoButton :label="words.whatIs" :body="words.whatIsBody" data-testid="convert-my-beads-info" />
      </span>
      <span class="my-beads__count" data-testid="convert-my-beads-count">{{ countText }}</span>
      <span class="my-beads__catalog">{{ catalogLine }}</span>
    </div>

    <MyBeadsPicker
      ref="picker"
      :bead="wizard.bead.value"
      :swatches="swatches"
      :catalog="wizard.beadCatalog.value"
      :codes="wizard.myBeadsCodes.value"
      :start-finishes="wizard.finishesApplied.value"
      @toggle="wizard.toggleMyBeadsCode"
      @add="wizard.addMyBeadsCodes"
      @clear="wizard.clearMyBeads"
    />
  </div>
</template>

<style scoped>
/* The same box as the Colors view: the head and tools stay, the rows scroll. */
.my-beads {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.my-beads__head {
  display: grid;
  flex: none;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: var(--space-4);
  padding: var(--space-10) var(--space-16) var(--space-10) var(--space-8);
  border-bottom: 1px solid var(--line-soft);
}

.my-beads__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
}

.my-beads__count {
  font: var(--type-meta);
  color: var(--muted);
  text-align: right;
}

/* Under the title, indented to it. */
.my-beads__catalog {
  grid-column: 2 / -1;
  font: var(--type-meta-small);
  color: var(--muted);
}

</style>
