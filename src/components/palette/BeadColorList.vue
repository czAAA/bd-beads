<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import { makerCodeOf } from '../../domain/beadCodeSearch'
import { familyColorId } from '../../domain/palette'
import { colorName } from '../../i18n/colorName'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import TextField from '../ui/form/TextField.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// The Bead's Color catalog (ticket 0537, ADR 0072; BeadColors card): every code the Project's Bead size has, each with a
// generated swatch that says it is approximate. A code whose color the Palette already holds is shown as taken and
// cannot be pressed. Adding is an Edit; the panel stays open to add more.
const props = defineProps<{ colors: BeadColors }>()
const emit = defineEmits<{ added: [hex: string] }>()

const SHOWN = 60
const { t } = useI18n()
const query = ref('')

onMounted(() => void props.colors.load())

/** A family's name in words: the Palette's name for the built-in color it is. */
const familyName = (family: string) => colorName(t.value, { id: familyColorId(family), hex: '' })

// A code is found as a part of a maker code or a family name, or typed the way a shop writes it (ticket 0696).
const matches = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const bead = props.colors.bead.value
  const typedCode = bead && makerCodeOf(query.value, bead)
  return props.colors.swatches.value.filter(
    (entry) =>
      !needle || entry.code === typedCode || entry.code.toLowerCase().includes(needle) || familyName(entry.family).toLowerCase().includes(needle),
  )
})
const shown = computed(() => matches.value.slice(0, SHOWN))

function add(hex: string, code: string) {
  if (props.colors.add(hex, code) === 'added') emit('added', hex)
}
</script>

<template>
  <div class="bead-color-list" role="group" :aria-label="t.palette.beadColors.label" data-testid="bead-colors">
    <AppNote data-testid="bead-colors-approximate">{{ t.palette.beadColors.approximate }} {{ t.palette.beadColors.takenNote }}</AppNote>
    <AppNote v-if="colors.state.value === 'loading'" role="status">{{ t.palette.beadColors.loading }}</AppNote>
    <AppNote v-else-if="colors.state.value === 'failed'" role="alert" data-testid="bead-colors-failed">{{ t.palette.beadColors.failed }}</AppNote>
    <template v-else>
      <TextField v-model="query" type="search" :aria-label="t.palette.beadColors.search" :placeholder="t.palette.beadColors.search" autocomplete="off" data-testid="bead-colors-search" />
      <ul class="bead-color-list__rows">
        <li v-for="entry in shown" :key="entry.code">
          <button
            type="button"
            class="bead-color-list__row"
            :class="{ 'bead-color-list__row--taken': entry.taken }"
            :aria-disabled="entry.taken ? 'true' : undefined"
            :aria-label="fillBlanks(entry.taken ? t.palette.beadColors.takenLabel : t.palette.beadColors.add, { code: entry.code })"
            data-testid="bead-color"
            :data-code="entry.code"
            :data-taken="entry.taken || undefined"
            @click="!entry.taken && add(entry.hex, entry.code)"
          >
            <span class="bead-color-list__chip" :class="{ 'bead-color-list__chip--approximate': entry.approximate }" :style="{ backgroundColor: entry.hex }" />
            <span class="bead-color-list__text">
              <span class="bead-color-list__code">{{ entry.code }}</span>
              <span class="bead-color-list__meta">
                {{ familyName(entry.family) }} · {{ t.palette.beadColors.finishes[entry.finish] }}
                <span v-if="entry.discontinued" class="bead-color-list__note"> · {{ t.palette.beadColors.discontinued }}</span>
              </span>
            </span>
            <span v-if="entry.taken" class="bead-color-list__taken">{{ t.palette.beadColors.inPalette }}</span>
          </button>
        </li>
      </ul>
      <AppNote v-if="matches.length === 0" data-testid="bead-colors-empty">{{ t.palette.beadColors.noMatch }}</AppNote>
      <AppNote v-else-if="matches.length > SHOWN">{{ fillBlanks(t.palette.beadColors.showingFirst, { count: SHOWN }) }}</AppNote>
    </template>
  </div>
</template>

<style scoped>
.bead-color-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  margin-top: var(--space-12);
}

.bead-color-list__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 16rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.bead-color-list__row {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-4) var(--space-6);
  font: var(--type-control);
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bead-color-list__row:hover {
  background: var(--surface);
}

.bead-color-list__row:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.bead-color-list__row--taken {
  color: var(--muted);
  cursor: default;
}

.bead-color-list__chip {
  flex: none;
  box-sizing: border-box;
  width: var(--field-height);
  height: var(--field-height);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
}

/* An approximate swatch has a dashed edge: it is made, not measured. */
.bead-color-list__chip--approximate {
  border-style: dashed;
}

.bead-color-list__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.bead-color-list__meta {
  font: var(--type-meta);
  color: var(--muted);
  overflow-wrap: anywhere;
}

/* The mark moves to the next line whole instead of breaking inside. */
.bead-color-list__note {
  display: inline-block;
}

.bead-color-list__taken {
  flex: none;
  font: var(--type-meta);
}
</style>
