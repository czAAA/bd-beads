<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SizeUnit } from '../domain/grid'
import { resolvePatternBead, type Pattern } from '../domain/pattern'
import type { ResizeRequest } from '../domain/resize'
import { planSizeChange, type SizeChangeProblem } from '../domain/sizeChange'
import { useI18n } from '../i18n/useI18n'
import ConfirmModal from './ConfirmModal.vue'

/**
 * Change size (ticket 153, CONTEXT.md's Resize, ADR 0017): sets the open Pattern's grid from a size stated in beads,
 * mm or cm. The numbers start as the current grid, so a Pattern made at the wrong size can keep them and only switch
 * the unit. mm/cm are converted once through the Pattern's Bead, by the same code as the New Pattern form, and then
 * forgotten: what is emitted is a plain Resize request for the grid.
 */
const props = defineProps<{ pattern: Pattern }>()

const emit = defineEmits<{
  confirm: [request: ResizeRequest]
  cancel: []
}>()

const { t } = useI18n()

const widthText = ref<string | number>(props.pattern.columns)
const heightText = ref<string | number>(props.pattern.rows)
const unit = ref<SizeUnit>('beads')

const bead = computed(() => resolvePatternBead(props.pattern))
const plan = computed(() =>
  planSizeChange(
    props.pattern,
    // A number input's v-model hands back a number once what is typed parses as one; the domain reads the text.
    { widthText: String(widthText.value), heightText: String(heightText.value), unit: unit.value },
    bead.value,
  ),
)

const problemMessages = computed<Record<SizeChangeProblem, string>>(() => ({
  empty: t.value.changeSize.problemEmpty,
  'not-a-number': t.value.changeSize.problemNotANumber,
  'not-positive': t.value.changeSize.problemNotPositive,
  'not-whole': t.value.changeSize.problemNotWhole,
  'no-bead': t.value.changeSize.problemNoBead,
}))

const unitLabels = computed<Record<SizeUnit, string>>(() => ({
  beads: t.value.form.unitBeads,
  mm: t.value.form.unitMm,
  cm: t.value.form.unitCm,
}))

/** What will happen, in the chosen unit and in beads; or, when the typed values can't be applied, why not. */
const message = computed(() => {
  const change = plan.value
  if (!change.ok) {
    return problemMessages.value[change.problem]
  }

  const from = `${props.pattern.columns} × ${props.pattern.rows}`
  const to = `${change.target.columns} × ${change.target.rows}`
  const text =
    unit.value === 'beads'
      ? t.value.changeSize.messageBeads.replace('{from}', from).replace('{to}', to)
      : t.value.changeSize.messagePhysical
          .replace('{from}', from)
          .replace('{size}', `${change.width} × ${change.height}`)
          .replace('{unit}', unitLabels.value[unit.value])
          .replace('{to}', to)
  return change.shrinks ? `${text} ${t.value.changeSize.shrinkWarning}` : text
})

function onConfirm() {
  const change = plan.value
  if (change.ok) {
    // Anchored at the end of both directions: growing adds empty rows/columns and shrinking keeps the top-left.
    emit('confirm', { ...change.target, columnsFrom: 'end', rowsFrom: 'end' })
  }
}
</script>

<template>
  <ConfirmModal
    :title="t.changeSize.title"
    :message="message"
    :confirm-label="t.changeSize.confirmButton"
    :cancel-label="t.changeSize.cancelButton"
    :confirm-danger="false"
    :confirm-disabled="!plan.ok"
    :message-error="!plan.ok"
    data-testid="change-size-modal"
    @confirm="onConfirm"
    @cancel="emit('cancel')"
  >
    <div class="change-size__fields">
      <div class="field">
        <label for="change-size-unit">{{ t.form.unitLabel }}</label>
        <select id="change-size-unit" v-model="unit" data-testid="change-size-unit">
          <option value="beads">{{ t.form.unitBeads }}</option>
          <option value="mm">{{ t.form.unitMm }}</option>
          <option value="cm">{{ t.form.unitCm }}</option>
        </select>
      </div>
      <div class="field">
        <label for="change-size-width">{{ t.changeSize.columnsLabel }}</label>
        <input
          id="change-size-width"
          v-model="widthText"
          data-testid="change-size-width"
          type="number"
          :min="unit === 'beads' ? 1 : 0"
          :step="unit === 'beads' ? 1 : 'any'"
        />
      </div>
      <div class="field">
        <label for="change-size-height">{{ t.changeSize.rowsLabel }}</label>
        <input
          id="change-size-height"
          v-model="heightText"
          data-testid="change-size-height"
          type="number"
          :min="unit === 'beads' ? 1 : 0"
          :step="unit === 'beads' ? 1 : 'any'"
        />
      </div>
    </div>
  </ConfirmModal>
</template>

<style scoped>
.change-size__fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
}
</style>
