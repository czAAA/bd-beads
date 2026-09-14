<script setup lang="ts">
import { computed, ref } from 'vue'
import { BEAD_CATALOG } from '../domain/beads'
import type { Technique } from '../domain/pattern'
import type { SizeUnit } from '../domain/grid'

export interface NewPatternSubmitPayload {
  technique: Technique
  beadId: string
  size: { width: number; height: number; unit: SizeUnit }
}

const emit = defineEmits<{
  submit: [payload: NewPatternSubmitPayload]
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
  <form @submit.prevent="onSubmit">
    <div class="field">
      <label for="bead-select">Bead</label>
      <select id="bead-select" v-model="beadId" data-testid="bead-select">
        <option v-for="bead in BEAD_CATALOG" :key="bead.id" :value="bead.id">
          {{ bead.brand }} {{ bead.name }} {{ bead.size }}
        </option>
      </select>
    </div>

    <div class="field">
      <label for="technique-select">Technique</label>
      <!-- Only Loom is supported so far; Peyote/Brick stitch land in a later ticket. -->
      <select id="technique-select" data-testid="technique-select" disabled>
        <option value="loom">Loom</option>
      </select>
    </div>

    <div class="field">
      <label for="width-input">Width</label>
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
      <label for="height-input">Height</label>
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
      <label for="unit-select">Unit</label>
      <select id="unit-select" v-model="unit" data-testid="unit-select">
        <option value="mm">mm</option>
        <option value="cm">cm</option>
      </select>
    </div>

    <button type="submit" :disabled="!isValid">Create Pattern</button>
  </form>
</template>
