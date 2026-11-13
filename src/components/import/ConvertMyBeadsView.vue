<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import type { TargetColor } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { formFactorName } from '../../domain/beads'
import { groupThousands } from '../../domain/formatNumber'
import { familyColorId } from '../../domain/palette'
import { colorName } from '../../i18n/colorName'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import InfoButton from '../ui/InfoButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'

// The Colors popover's My beads view (ConvertImage card DS-2, ticket 0902): the same box turned to the list of codes the
// person owns in the Bead's Color catalog, each row one button that ticks its code. Back, or Escape, returns to the Colors
// view. Ticket 0903 adds the search, Filters, Paste codes and Clear list between the switch and the rows and at the foot.
const emit = defineEmits<{ back: [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.myBeads)
const rootEl = ref<HTMLElement>()

const owned = computed(() => new Set(wizard.myBeadsCodes.value))
const listed = computed(() => wizard.myBeadsCodes.value.length)
const countText = computed(() => (listed.value > 0 ? plural(locale.value, listed.value, words.value.codes) : words.value.noCodes))
const catalogLine = computed(() => {
  const { brand, formFactor } = wizard.bead.value
  return fillBlanks(words.value.catalog, { catalog: `${brand.name} ${formFactorName(formFactor)}`.toLocaleLowerCase(locale.value) })
})

/** All codes, or My beads: opens on My beads when the list has codes. The My beads half keeps the rows it opened with,
 * so a code unticked there stays where it is. */
const half = ref<'all' | 'mine'>(listed.value > 0 ? 'mine' : 'all')
const mineShown = ref(new Set(wizard.myBeadsCodes.value))
const setHalf = (next: 'all' | 'mine') => {
  if (next === 'mine') mineShown.value = new Set(wizard.myBeadsCodes.value)
  half.value = next
}
const halves = computed(() => [
  { value: 'all' as const, label: words.value.allCodes, meta: groupThousands(wizard.beadTargets.value.length, locale.value) },
  { value: 'mine' as const, label: words.value.name, meta: groupThousands(wizard.myBeadsTargets.value.length, locale.value) },
])

/** The Bead's codes made in its size, or on My beads those of the list. */
const rows = computed(() => (half.value === 'mine' && listed.value > 0 ? wizard.beadTargets.value.filter((target) => mineShown.value.has(target.code!)) : wizard.beadTargets.value))
const shownCount = computed(() => fillBlanks(words.value.shown, { count: groupThousands(rows.value.length, locale.value) }))

/** A code's second line, its family and Finish in lower case ("red opaque"). */
function nameOf(target: TargetColor): string {
  const family = colorName(t.value, { id: familyColorId(target.family!), hex: '' })
  const finish = target.finish ? t.value.palette.beadColors.finishes[target.finish] : ''
  return `${family} ${finish}`.trim().toLocaleLowerCase(locale.value)
}

function rowLabel(target: TargetColor): string {
  const name = nameOf(target)
  return owned.value.has(target.code!) ? fillBlanks(words.value.rowOwned, { code: target.code!, name }) : `${target.code} ${name}`
}

// The view is a layer over the Colors popover: Escape comes back to Colors; a press outside closes the popover.
useOverlayLayer({ isOpen: () => true, root: () => rootEl.value, close: () => emit('back'), onOutsidePress: () => wizard.closePopover() })
onMounted(() => rootEl.value?.querySelector<HTMLElement>('[data-testid="convert-my-beads-back"]')?.focus({ preventScroll: true }))
</script>

<template>
  <div ref="rootEl" class="my-beads" data-testid="convert-my-beads">
    <div class="my-beads__head">
      <IconButton icon="arrow-left" variant="plain" :label="words.back" data-testid="convert-my-beads-back" @click="emit('back')" />
      <span class="my-beads__title">
        {{ words.name }}
        <InfoButton :label="words.whatIs" :body="words.whatIsBody" data-testid="convert-my-beads-info" />
      </span>
      <span class="my-beads__count" data-testid="convert-my-beads-count">{{ countText }}</span>
      <span class="my-beads__catalog">{{ catalogLine }}</span>
    </div>

    <div class="my-beads__tools">
      <p v-if="listed === 0" class="my-beads__empty" role="status" data-testid="convert-my-beads-empty">{{ words.empty }}</p>
      <SegmentedControl
        v-else
        :model-value="half"
        :options="halves"
        :aria-label="words.name"
        small
        class="my-beads__switch"
        data-testid="convert-my-beads-switch"
        @update:model-value="setHalf"
      />
      <span class="my-beads__shown" data-testid="convert-my-beads-shown">{{ shownCount }}</span>
    </div>

    <ul class="my-beads__rows" data-testid="convert-my-beads-rows">
      <li v-for="target in rows" :key="target.code">
        <button
          type="button"
          class="ui-control my-beads__row"
          :aria-pressed="owned.has(target.code!)"
          :aria-label="rowLabel(target)"
          :data-code="target.code"
          data-testid="convert-my-beads-row"
          @click="wizard.toggleMyBeadsCode(target.code!)"
        >
          <span class="my-beads__swatch" :style="{ backgroundColor: target.hex }" aria-hidden="true" />
          <span class="my-beads__lines">
            <span class="my-beads__code">{{ target.code }}</span>
            <span class="my-beads__name">{{ nameOf(target) }}</span>
          </span>
          <span class="my-beads__tick" aria-hidden="true">
            <AppIcon v-if="owned.has(target.code!)" name="check" :size="14" />
          </span>
        </button>
      </li>
    </ul>
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

.my-beads__tools {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-10);
  padding: var(--space-12) var(--space-16) 0;
}

.my-beads__empty {
  margin: 0;
  padding: var(--space-10) var(--space-12);
  font: var(--type-small);
  color: var(--body);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.my-beads__shown {
  font: var(--type-meta-small);
  color: var(--muted);
}

.my-beads__rows {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: var(--space-4) var(--space-8) 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  scrollbar-width: thin;
}

/* Under 1024 px or in portrait the popover stands in the column's flow, which scrolls: the rows need not. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .my-beads__rows {
    overflow-y: visible;
  }
}

.my-beads__row {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--my-beads-row);
  padding: var(--space-2) var(--space-8);
  color: var(--ink);
  text-align: left;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--line-soft);
  cursor: pointer;
}

@media (pointer: coarse) {
  .my-beads__row {
    min-height: var(--my-beads-row-touch);
  }
}

@media (hover: hover) {
  .my-beads__row:hover {
    background: var(--hover-fill);
  }
}

.my-beads__row:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: calc(-1 * var(--focus-width));
}

.my-beads__swatch {
  flex: none;
  width: var(--my-beads-swatch);
  height: var(--my-beads-swatch);
  border: 1px solid var(--swatch-edge);
  border-radius: var(--radius-xs);
}

.my-beads__lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.my-beads__code {
  font: var(--type-control);
}

.my-beads__name {
  font: var(--type-meta-small);
  color: var(--muted);
}

.my-beads__tick {
  display: grid;
  flex: none;
  place-items: center;
  box-sizing: border-box;
  width: var(--my-beads-tick);
  height: var(--my-beads-tick);
  color: var(--canvas);
  background: var(--canvas);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-xs);
}

.my-beads__row[aria-pressed='true'] .my-beads__tick {
  background: var(--ink);
  border-color: var(--ink);
}
</style>
