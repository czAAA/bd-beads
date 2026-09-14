<script setup lang="ts">
import { computed, ref } from 'vue'
import { BEAD_CATALOG } from '../domain/beads'
import type { CreatePatternInput } from '../domain/pattern'
import type { SizeUnit } from '../domain/grid'
import { useI18n } from '../i18n/useI18n'

const { t } = useI18n()

const emit = defineEmits<{
  submit: [payload: CreatePatternInput]
}>()

const beadId = ref(BEAD_CATALOG[0]!.id)
const widthText = ref('')
const heightText = ref('')
const unit = ref<SizeUnit>('mm')

const width = computed(() => Number(widthText.value))
const height = computed(() => Number(heightText.value))
const isValid = computed(() => width.value > 0 && height.value > 0)

function onSubmit() {
  if (!isValid.value) {
    return
  }

  emit('submit', {
    technique: 'loom',
    beadId: beadId.value,
    size: { width: width.value, height: height.value, unit: unit.value },
  })
}
</script>

<template>
  <form class="new-pattern-form" @submit.prevent="onSubmit">
    <div class="field">
      <label for="bead-select">{{ t.form.beadLabel }}</label>
      <select id="bead-select" v-model="beadId" data-testid="bead-select">
        <option v-for="bead in BEAD_CATALOG" :key="bead.id" :value="bead.id">
          {{ bead.brand }} {{ bead.name }} {{ bead.size }}
        </option>
      </select>
    </div>

    <div class="field">
      <label for="technique-select">{{ t.form.techniqueLabel }}</label>
      <!-- Only Loom is supported so far; Peyote/Brick stitch land in a later ticket. -->
      <select id="technique-select" data-testid="technique-select" disabled>
        <option value="loom">{{ t.form.techniqueLoom }}</option>
      </select>
    </div>

    <div class="field">
      <label for="width-input">{{ t.form.widthLabel }}</label>
      <input
        id="width-input"
        v-model="widthText"
        data-testid="width-input"
        type="number"
        min="0"
        step="any"
      />
    </div>

    <div class="field">
      <label for="height-input">{{ t.form.heightLabel }}</label>
      <input
        id="height-input"
        v-model="heightText"
        data-testid="height-input"
        type="number"
        min="0"
        step="any"
      />
    </div>

    <div class="field">
      <label for="unit-select">{{ t.form.unitLabel }}</label>
      <select id="unit-select" v-model="unit" data-testid="unit-select">
        <option value="mm">{{ t.form.unitMm }}</option>
        <option value="cm">{{ t.form.unitCm }}</option>
      </select>
    </div>

    <button type="submit" :disabled="!isValid">{{ t.form.submit }}</button>
  </form>
</template>

<style scoped>
.new-pattern-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 360px;
  padding: 24px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.field {
  display: flex;
  flex-direction: column;
}
</style>
