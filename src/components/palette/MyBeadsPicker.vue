<script setup lang="ts">
import { computed, nextTick, ref, toRef, useId } from 'vue'
import { SHOWN, useBeadColorFinder } from '../../composables/palette/useBeadColorFinder'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import type { Bead } from '../../domain/beads'
import type { CatalogSwatch } from '../../domain/beadSwatch'
import type { ColorCatalog, Finish } from '../../domain/colorCatalog'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { pastedCodes, type PastedCodes } from '../../domain/myBeads'
import { plural, pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppNote from '../ui/AppNote.vue'
import IconButton from '../ui/IconButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'
import BeadColorFilters from './BeadColorFilters.vue'
import BeadColorFindRow from './BeadColorFindRow.vue'

// My beads' picker (ConvertImage card DS-2, tickets 0902, 0903): the BeadColors list in its narrow layout, each row one
// button that ticks its code, the switch All codes | My beads, and a foot that pastes codes and clears the list. The
// converter's My beads view holds it; the editor's Palette popover takes it as it is (ticket 0918).
const props = defineProps<{
  bead: Bead
  /** The Bead's codes in its size, discontinued ones too, from its loaded Color catalog. */
  swatches: readonly CatalogSwatch[]
  /** The catalog itself: a pasted code of any of its sizes is known, a listed code it lacks is greyed. */
  catalog: ColorCatalog | undefined
  /** The list's codes, in the order they were added. */
  codes: readonly string[]
  /** The Finishes the filters open with (the converter's, ticket 0901). */
  startFinishes?: readonly Finish[]
}>()
const emit = defineEmits<{ toggle: [code: string]; add: [codes: string[]]; clear: [] }>()

const { t, locale } = useI18n()
const words = computed(() => t.value.convertImage.wizard.myBeads)
const rootEl = ref<HTMLElement>()
const fieldId = useId()

/** A row: a code of the Bead's size, or a listed code the catalog does not know at all. */
type Row = { code: string; family?: string; finish?: Finish; hex?: string; discontinued?: boolean; unknown?: boolean }

const owned = computed(() => new Set(props.codes))
const listed = computed(() => props.codes.length)
const known = computed(() => new Set(props.catalog?.codes.map((entry) => entry.code)))
const offered = computed(() => props.swatches.filter((swatch) => !swatch.discontinued))

/** All codes, or My beads: opens on My beads when the list has codes. The My beads half keeps the rows it opened with,
 * so a code unticked there stays where it is; a paste adds its codes to them. */
const half = ref<'all' | 'mine'>(listed.value > 0 ? 'mine' : 'all')
const mineShown = ref(new Set(props.codes))
const setHalf = (next: 'all' | 'mine') => {
  if (next === 'mine') mineShown.value = new Set(props.codes)
  half.value = next
}
const halves = computed(() => [
  { value: 'all' as const, label: words.value.allCodes, meta: groupThousands(offered.value.length, locale.value) },
  { value: 'mine' as const, label: words.value.name, meta: groupThousands(offered.value.filter((swatch) => owned.value.has(swatch.code)).length, locale.value) },
])

/** The Bead's codes made now, or on My beads the list's: those of its size, discontinued ones greyed, then those the
 * catalog no longer knows. A code of another size of the catalog is the list's but not this view's. */
const rows = computed<readonly Row[]>(() => {
  if (half.value === 'all' || listed.value === 0) return offered.value
  const mine = props.swatches.filter((swatch) => mineShown.value.has(swatch.code))
  const lost = props.catalog ? [...mineShown.value].filter((code) => !known.value.has(code)).map((code) => ({ code, unknown: true })) : []
  return [...mine, ...lost]
})

const { query, familyName, matches, shown, families, finishes, filtersOnCount, filtersOn, filtersOpen, emptyText, toggleFamily, toggleFinish, clearFilters } = useBeadColorFinder({
  swatches: rows,
  bead: toRef(props, 'bead'),
  catalog: toRef(props, 'catalog'),
  startFinishes: props.startFinishes,
})

/** A code's second line, its family and Finish in lower case ("red opaque"), and why it is never matched. */
function nameOf(row: Row): string {
  if (row.unknown) return words.value.unknownRow
  const finish = row.finish ? t.value.palette.beadColors.finishes[row.finish] : ''
  const name = `${row.family ? familyName(row.family) : ''} ${finish}`.trim().toLocaleLowerCase(locale.value)
  return row.discontinued ? fillBlanks(words.value.discontinuedRow, { name }) : name
}

/** Paste codes: the box open, its text, and what the last paste did. */
const pasting = ref(false)
const pasteText = ref('')
const result = ref<PastedCodes>()
const confirming = ref(false)
const pasteField = ref<InstanceType<typeof TextField>>()
const focusIn = async (testid: string) => {
  await nextTick()
  rootEl.value?.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.focus()
}

async function openPaste() {
  if (pasting.value) return closePaste()
  confirming.value = false
  pasting.value = true
  await nextTick()
  pasteField.value?.focus({ asked: true })
}
function closePaste() {
  pasting.value = false
  pasteText.value = ''
  void focusIn('my-beads-paste')
}

/** Adds the codes of a text the catalog knows, says what was added and what not, and shows the list. */
function addFrom(text: string) {
  if (!props.catalog) return
  const pasted = pastedCodes(text, props.catalog, props.bead, props.codes)
  if (pasted.added.length + pasted.already.length + pasted.unknown.length === 0) return
  if (pasted.added.length > 0) {
    emit('add', pasted.added)
    mineShown.value = new Set([...mineShown.value, ...pasted.added])
    half.value = 'mine'
  }
  result.value = pasted
}
function addCodes() {
  addFrom(pasteText.value)
  closePaste()
}

const resultLines = computed(() => {
  const pasted = result.value
  if (!pasted) return undefined
  const count = (n: number) => groupThousands(n, locale.value)
  return {
    added: plural(locale.value, pasted.added.length, words.value.added),
    already: pasted.already.length > 0 ? plural(locale.value, pasted.already.length, words.value.already) : undefined,
    unknown:
      pasted.unknown.length > 0
        ? fillBlanks(pluralForm(locale.value, pasted.unknown.length, words.value.notKnown), { codes: pasted.unknown.join(', ') }, { count: count(pasted.unknown.length) })
        : undefined,
  }
})

/** ⌘V (Ctrl+V) in the view, outside a text field and while Clear list is not asked: the clipboard's codes are added at
 * once, with no box. */
function onPaste(event: ClipboardEvent) {
  const target = event.target
  if (confirming.value || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text.trim()) return
  event.preventDefault()
  addFrom(text)
}

async function askClear() {
  pasting.value = false
  pasteText.value = ''
  confirming.value = true
  await focusIn('my-beads-clear-cancel')
}
function cancelClear() {
  confirming.value = false
  void focusIn('my-beads-clear')
}
function clearList() {
  confirming.value = false
  result.value = undefined
  emit('clear')
  void focusIn('my-beads-paste')
}

// The paste box and the confirm are a layer over the view: Escape closes them and keeps nothing.
useOverlayLayer({
  isOpen: () => pasting.value || confirming.value,
  root: () => rootEl.value,
  close: () => (pasting.value ? closePaste() : cancelClear()),
  outside: 'through',
})

defineExpose({ onPaste })
</script>

<template>
  <div ref="rootEl" class="my-beads-picker" data-testid="my-beads-picker">
    <div class="my-beads-picker__tools">
      <div v-if="pasting" class="my-beads-picker__box" data-testid="my-beads-paste-box">
        <label class="my-beads-picker__label" :for="fieldId">{{ words.pasteLabel }}</label>
        <TextField
          :id="fieldId"
          ref="pasteField"
          v-model="pasteText"
          multiline
          rows="4"
          class="my-beads-picker__field"
          :placeholder="words.pastePlaceholder"
          data-testid="my-beads-paste-field"
        />
        <div class="my-beads-picker__actions">
          <AppButton class="my-beads-picker__add" data-testid="my-beads-add" @click="addCodes">{{ words.addCodes }}</AppButton>
          <AppButton variant="text" data-testid="my-beads-paste-cancel" @click="closePaste">{{ words.cancel }}</AppButton>
        </div>
      </div>
      <div v-else-if="resultLines" class="my-beads-picker__box my-beads-picker__result" role="status" data-testid="my-beads-result">
        <AppIcon name="check" :size="18" class="my-beads-picker__result-icon" />
        <span class="my-beads-picker__result-lines">
          <span class="my-beads-picker__added" data-testid="my-beads-added">{{ resultLines.added }}</span>
          <span v-if="resultLines.already" class="my-beads-picker__note" data-testid="my-beads-already">{{ resultLines.already }}</span>
          <span v-if="resultLines.unknown" class="my-beads-picker__note my-beads-picker__unknown" data-testid="my-beads-unknown">{{ resultLines.unknown }}</span>
        </span>
        <IconButton icon="close" variant="plain" class="my-beads-picker__dismiss" :label="words.dismiss" data-testid="my-beads-dismiss" @click="result = undefined" />
      </div>

      <p v-if="listed === 0" class="my-beads-picker__empty" role="status" data-testid="convert-my-beads-empty">{{ words.empty }}</p>
      <SegmentedControl
        v-else
        :model-value="half"
        :options="halves"
        :aria-label="words.name"
        small
        data-testid="convert-my-beads-switch"
        @update:model-value="setHalf"
      />

      <BeadColorFindRow v-model:query="query" v-model:open="filtersOpen" :filters-on-count="filtersOnCount" />
      <BeadColorFilters
        v-if="filtersOpen"
        :families="families"
        :finishes="finishes"
        :any-on="filtersOn"
        :open="filtersOpen"
        @toggle-family="toggleFamily"
        @toggle-finish="toggleFinish"
        @clear="clearFilters"
      />
      <p class="my-beads-picker__count" data-testid="convert-my-beads-shown">
        <span>{{ fillBlanks(words.shown, { count: groupThousands(matches.length, locale) }) }}</span>
        <span v-if="matches.length > SHOWN">{{ fillBlanks(t.palette.beadColors.firstShown, { count: SHOWN }) }}</span>
      </p>
    </div>

    <ul class="my-beads-picker__rows" data-testid="convert-my-beads-rows">
      <li v-for="row in shown" :key="row.code">
        <button
          type="button"
          class="ui-control my-beads-picker__row"
          :class="{ 'my-beads-picker__row--never': row.discontinued || row.unknown }"
          :aria-pressed="owned.has(row.code)"
          :data-code="row.code"
          data-testid="convert-my-beads-row"
          @click="emit('toggle', row.code)"
        >
          <span class="my-beads-picker__swatch" :style="row.hex ? { backgroundColor: row.hex } : undefined" aria-hidden="true" />
          <span class="my-beads-picker__lines">
            <span class="my-beads-picker__code">{{ row.code }}</span>
            {{ ' ' }}
            <span class="my-beads-picker__name">{{ nameOf(row) }}</span>
          </span>
          <span class="my-beads-picker__tick" aria-hidden="true">
            <AppIcon v-if="owned.has(row.code)" name="check" :size="14" />
          </span>
        </button>
      </li>
    </ul>
    <div v-if="matches.length === 0" class="my-beads-picker__nothing">
      <AppNote data-testid="bead-colors-empty">{{ emptyText }}</AppNote>
    </div>

    <div class="my-beads-picker__foot" data-testid="my-beads-foot">
      <template v-if="confirming">
        <span class="my-beads-picker__ask" data-testid="my-beads-clear-ask">{{ plural(locale, listed, words.clearAll) }}</span>
        <span class="my-beads-picker__answers">
          <AppButton variant="text" data-testid="my-beads-clear-cancel" @click="cancelClear">{{ words.cancel }}</AppButton>
          <AppButton variant="danger" data-testid="my-beads-clear-confirm" @click="clearList">{{ words.clearList }}</AppButton>
        </span>
      </template>
      <template v-else>
        <AppButton icon="paste" class="my-beads-picker__paste" :aria-expanded="pasting" data-testid="my-beads-paste" @click="openPaste">{{ words.pasteCodes }}</AppButton>
        <AppButton v-if="listed > 0" variant="text" class="my-beads-picker__clear" data-testid="my-beads-clear" @click="askClear">{{ words.clearList }}</AppButton>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* The BeadColors list in its narrow layout: the find row and filters stay, the rows scroll, the foot stays. */
.my-beads-picker {
  container: bead-list / inline-size;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.my-beads-picker__tools {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-12) var(--space-16) 0;
}

.my-beads-picker__box {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-10) var(--space-12) var(--space-12);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.my-beads-picker__label {
  font: var(--type-label);
  color: var(--muted);
}

.my-beads-picker__box :deep(.my-beads-picker__field) {
  font: var(--type-meta);
}

.my-beads-picker__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

/* Add codes is secondary with an ink edge: the accent is Create Project's. */
.my-beads-picker__add {
  border-color: var(--ink);
}

.my-beads-picker__result {
  flex-direction: row;
  align-items: flex-start;
  padding: var(--space-10) var(--space-6) var(--space-10) var(--space-12);
}

.my-beads-picker__result-icon {
  flex: none;
  color: var(--ink);
}

.my-beads-picker__result-lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.my-beads-picker__added {
  font: var(--type-control);
  color: var(--ink);
}

.my-beads-picker__note {
  font: var(--type-meta);
  color: var(--muted);
}

/* The codes not known wrap anywhere: a pasted line need not have spaces. */
.my-beads-picker__unknown {
  overflow-wrap: anywhere;
}

.my-beads-picker__dismiss {
  flex: none;
  width: var(--message-close-size);
  height: var(--message-close-size);
}

@media (pointer: coarse) {
  .my-beads-picker__dismiss {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}

.my-beads-picker__empty {
  margin: 0;
  padding: var(--space-10) var(--space-12);
  font: var(--type-small);
  color: var(--body);
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
}

.my-beads-picker__count {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-8);
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.my-beads-picker__rows {
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
  .my-beads-picker__rows {
    overflow-y: visible;
  }
}

.my-beads-picker__nothing {
  padding: var(--space-8) var(--space-16);
}

.my-beads-picker__row {
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
  .my-beads-picker__row {
    min-height: var(--my-beads-row-touch);
  }
}

@media (hover: hover) {
  .my-beads-picker__row:hover {
    background: var(--hover-fill);
  }
}

.my-beads-picker__row:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: calc(-1 * var(--focus-width));
}

.my-beads-picker__swatch {
  flex: none;
  box-sizing: border-box;
  width: var(--my-beads-swatch);
  height: var(--my-beads-swatch);
  border: 1px solid var(--swatch-edge);
  border-radius: var(--radius-xs);
}

.my-beads-picker__lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.my-beads-picker__code {
  font: var(--type-control);
}

.my-beads-picker__name {
  font: var(--type-meta-small);
  color: var(--muted);
}

/* A code never matched (discontinued, or no longer in the catalog): its swatch faded, its code faint. */
.my-beads-picker__row--never .my-beads-picker__swatch {
  opacity: var(--my-beads-never-opacity);
}

.my-beads-picker__row--never .my-beads-picker__code {
  color: var(--faint);
}

.my-beads-picker__tick {
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

.my-beads-picker__row[aria-pressed='true'] .my-beads-picker__tick {
  background: var(--ink);
  border-color: var(--ink);
}

/* The foot: Paste codes at the left, Clear list at the right, wrapping; the confirm in its place. */
.my-beads-picker__foot {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-10) var(--space-16) var(--space-12);
  border-top: 1px solid var(--line-soft);
}

@media (pointer: coarse) {
  .my-beads-picker__foot {
    padding-bottom: var(--space-16);
  }
}

/* Pressed, Paste codes is drawn on while its box is open. */
.my-beads-picker__paste[aria-expanded='true'] {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

.my-beads-picker__clear {
  color: var(--muted);
}

.my-beads-picker__ask {
  flex: 1 1 12rem;
  min-width: 0;
  font: var(--type-control);
  color: var(--ink);
}

.my-beads-picker__answers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}
</style>
