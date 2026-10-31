<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { Finish } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'

// The Bead colors list's filters as one piece (BeadColors card, ticket 0746): Color swatches, the Finish check list and
// Clear filters. The list puts it in a column beside the rows or behind its Filters disclosure; it looks the same in both.
defineProps<{
  families: { family: string; name: string; hex: string; on: boolean; count: number }[]
  finishes: { finish: Finish; name: string; on: boolean; count: number }[]
  anyOn: boolean
  /** The Filters disclosure is open: the list passes it so the piece re-syncs its Tab stops when it shows. */
  open: boolean
}>()
defineEmits<{ 'toggle-family': [family: string]; 'toggle-finish': [finish: Finish]; clear: [] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.palette.beadColors)
const valueName = (name: string, count: number) => fillBlanks(words.value.valueCount, { name, count: groupThousands(count, locale.value) })

const colorRow = ref<HTMLElement>()
const finishRow = ref<HTMLElement>()
const colorRoving = useRovingFocus(colorRow, { axis: () => 'both', managesTabIndex: true })
const finishRoving = useRovingFocus(finishRow, { axis: () => 'vertical', managesTabIndex: true })
</script>

<template>
  <div class="bead-color-filters" :class="{ 'bead-color-filters--open': open }" data-testid="bead-colors-filters">
    <div class="bead-color-filters__part">
      <span class="bead-color-filters__label" aria-hidden="true">{{ words.colorFilter }}</span>
      <div
        ref="colorRow"
        class="bead-color-filters__colors"
        role="group"
        :aria-label="words.colorFilter"
        data-testid="bead-colors-filter-color"
        @keydown="colorRoving.onKeydown"
        @focusin="colorRoving.onFocusin"
      >
        <AppTooltip v-for="item in families" :key="item.family" :name="valueName(item.name, item.count)" :announce="false">
          <button
            type="button"
            class="bead-color-filters__family"
            :class="{ 'bead-color-filters__family--on': item.on, 'bead-color-filters__value--none': item.count === 0 }"
            :style="{ backgroundColor: item.hex }"
            :aria-pressed="item.on"
            :aria-label="valueName(item.name, item.count)"
            data-testid="bead-colors-family"
            :data-value="item.family"
            :data-none="item.count === 0 || undefined"
            @click="$emit('toggle-family', item.family)"
          />
        </AppTooltip>
      </div>
    </div>
    <div class="bead-color-filters__part">
      <span class="bead-color-filters__label" aria-hidden="true">{{ words.finishFilter }}</span>
      <div
        ref="finishRow"
        class="bead-color-filters__finishes"
        role="group"
        :aria-label="words.finishFilter"
        data-testid="bead-colors-filter-finish"
        @keydown="finishRoving.onKeydown"
        @focusin="finishRoving.onFocusin"
      >
        <button
          v-for="item in finishes"
          :key="item.finish"
          type="button"
          class="bead-color-filters__finish"
          :class="{ 'bead-color-filters__finish--on': item.on, 'bead-color-filters__value--none': item.count === 0 }"
          :aria-pressed="item.on"
          :aria-label="valueName(item.name, item.count)"
          data-testid="bead-colors-finish"
          :data-value="item.finish"
          :data-none="item.count === 0 || undefined"
          @click="$emit('toggle-finish', item.finish)"
        >
          <span class="bead-color-filters__box" aria-hidden="true"><AppIcon v-if="item.on" name="check" :size="12" /></span>
          <span class="bead-color-filters__name">{{ item.name }}</span>
          <span class="bead-color-filters__count">{{ groupThousands(item.count, locale) }}</span>
        </button>
      </div>
    </div>
    <AppButton v-if="anyOn" variant="link" class="bead-color-filters__clear" data-testid="bead-colors-filters-clear" @click="$emit('clear')">{{ words.clearFilters }}</AppButton>
  </div>
</template>

<style scoped>
.bead-color-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  box-sizing: border-box;
  padding: var(--space-10) var(--space-8) var(--space-10) var(--space-10);
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.bead-color-filters__part {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.bead-color-filters__label {
  font: var(--type-label);
  color: var(--muted);
}

.bead-color-filters__colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

/* A family as its swatch (PaletteSwatches card): the same edge, and the Palette's selected ring while it is on. */
.bead-color-filters__family {
  box-sizing: border-box;
  width: var(--filter-swatch);
  height: var(--filter-swatch);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
  cursor: pointer;
}

.bead-color-filters__family--on {
  box-shadow:
    inset 0 0 0 1px var(--swatch-edge),
    0 0 0 2px var(--surface),
    0 0 0 4px var(--ring);
}

.bead-color-filters__finishes {
  display: flex;
  flex-direction: column;
}

/* Narrow: the disclosure is the full width, so the Finish list runs in two columns (480px, as in BeadColorList). */
@container bead-list (max-width: 479.98px) {
  .bead-color-filters__finishes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: var(--space-8);
  }
}

/* A Finish as a check line: box, name, the live count at the right. */
.bead-color-filters__finish {
  display: flex;
  gap: var(--space-6);
  align-items: center;
  box-sizing: border-box;
  height: var(--filter-chip-height);
  padding: 0 var(--space-6);
  font: var(--type-tab);
  color: var(--ink);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bead-color-filters__finish:hover {
  background: var(--hover-fill);
}

.bead-color-filters__finish--on .bead-color-filters__name {
  font-weight: 600;
}

.bead-color-filters__box {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--filter-check);
  height: var(--filter-check);
  color: var(--canvas);
  background: var(--canvas);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-xs);
}

.bead-color-filters__finish--on .bead-color-filters__box {
  background: var(--ink);
  border-color: var(--ink);
}

.bead-color-filters__name {
  min-width: 0;
  flex: 1 1 auto;
}

.bead-color-filters__count {
  flex: none;
  font: var(--type-meta-small);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* A value with no rows is dimmed, not disabled: pressing it still turns it on (ticket 0713). */
.bead-color-filters__value--none {
  opacity: var(--swatch-faded-opacity);
}

.bead-color-filters__family:focus-visible,
.bead-color-filters__finish:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-color-filters__clear {
  align-self: flex-start;
  color: var(--muted);
}

@media (pointer: coarse) {
  .bead-color-filters__family {
    width: var(--swatch-touch-min);
    height: var(--swatch-touch-min);
  }

  .bead-color-filters__finish {
    height: var(--swatch-touch-min);
  }
}
</style>
