<script setup lang="ts">
import { computed, ref } from 'vue'
import { beadLabel, type Bead, type FormFactor } from '../domain/beads'
import { useI18n } from '../i18n/useI18n'

/** A bead's own color is a real-world physical property, independent of the Palette used to paint cells (ADR 0002) — so it gets its own color input rather than reusing PalettePicker/PALETTE. */
const DEFAULT_COLOR = '#e63746'

defineProps<{ seededBeads: readonly Bead[]; customBeads: Bead[] }>()
const emit = defineEmits<{
  add: [bead: Bead]
  edit: [bead: Bead]
  remove: [id: string]
}>()
const { t } = useI18n()

const formFactorOptions = computed<{ value: FormFactor; label: string }[]>(() => [
  { value: 'cube', label: t.value.catalog.formFactorCube },
  { value: 'round', label: t.value.catalog.formFactorRound },
  { value: 'cylinder', label: t.value.catalog.formFactorCylinder },
])

const editingId = ref<string | undefined>()
const brand = ref('')
const name = ref('')
const size = ref('')
const formFactor = ref<FormFactor>('round')
const color = ref(DEFAULT_COLOR)
const widthText = ref('')
const heightText = ref('')

const width = computed(() => Number(widthText.value))
const height = computed(() => Number(heightText.value))
const isValid = computed(
  () =>
    brand.value.trim() !== '' &&
    name.value.trim() !== '' &&
    size.value.trim() !== '' &&
    width.value > 0 &&
    height.value > 0,
)

function resetForm() {
  editingId.value = undefined
  brand.value = ''
  name.value = ''
  size.value = ''
  formFactor.value = 'round'
  color.value = DEFAULT_COLOR
  widthText.value = ''
  heightText.value = ''
}

function onEdit(bead: Bead) {
  editingId.value = bead.id
  brand.value = bead.brand
  name.value = bead.name
  size.value = bead.size
  formFactor.value = bead.formFactor
  color.value = bead.color ?? DEFAULT_COLOR
  widthText.value = String(bead.widthMm)
  heightText.value = String(bead.heightMm)
}

function onSubmit() {
  if (!isValid.value) {
    return
  }

  const bead: Bead = {
    id: editingId.value ?? crypto.randomUUID(),
    brand: brand.value.trim(),
    name: name.value.trim(),
    size: size.value.trim(),
    formFactor: formFactor.value,
    color: color.value,
    widthMm: width.value,
    heightMm: height.value,
  }

  if (editingId.value) {
    emit('edit', bead)
  } else {
    emit('add', bead)
  }
  resetForm()
}
</script>

<template>
  <section class="bead-catalog" data-testid="bead-catalog">
    <h2>{{ t.catalog.heading }}</h2>
    <ul class="bead-catalog__list">
      <li
        v-for="bead in seededBeads"
        :key="bead.id"
        class="bead-catalog__item"
        data-testid="catalog-seeded-item"
      >
        <span
          class="bead-catalog__swatch"
          :style="{ backgroundColor: bead.color ?? 'transparent' }"
        />
        {{ beadLabel(bead) }}
      </li>
      <li
        v-for="bead in customBeads"
        :key="bead.id"
        class="bead-catalog__item"
        data-testid="catalog-custom-item"
      >
        <span
          class="bead-catalog__swatch"
          :style="{ backgroundColor: bead.color ?? 'transparent' }"
        />
        {{ beadLabel(bead) }}
        <button type="button" :data-testid="`catalog-edit-${bead.id}`" @click="onEdit(bead)">
          {{ t.catalog.editButton }}
        </button>
        <button
          type="button"
          class="button--danger"
          :data-testid="`catalog-remove-${bead.id}`"
          @click="emit('remove', bead.id)"
        >
          {{ t.catalog.removeButton }}
        </button>
      </li>
    </ul>

    <form class="bead-catalog__form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="catalog-brand-input">{{ t.catalog.brandLabel }}</label>
        <input id="catalog-brand-input" v-model="brand" data-testid="catalog-brand-input" type="text" />
      </div>

      <div class="field">
        <label for="catalog-name-input">{{ t.catalog.nameLabel }}</label>
        <input id="catalog-name-input" v-model="name" data-testid="catalog-name-input" type="text" />
      </div>

      <div class="field">
        <label for="catalog-size-input">{{ t.catalog.sizeLabel }}</label>
        <input id="catalog-size-input" v-model="size" data-testid="catalog-size-input" type="text" />
      </div>

      <div class="field">
        <label for="catalog-form-factor-select">{{ t.catalog.formFactorLabel }}</label>
        <select
          id="catalog-form-factor-select"
          v-model="formFactor"
          data-testid="catalog-form-factor-select"
        >
          <option v-for="option in formFactorOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="catalog-width-input">{{ t.catalog.widthLabel }}</label>
        <input
          id="catalog-width-input"
          v-model="widthText"
          data-testid="catalog-width-input"
          type="number"
          min="0"
          step="any"
        />
      </div>

      <div class="field">
        <label for="catalog-height-input">{{ t.catalog.heightLabel }}</label>
        <input
          id="catalog-height-input"
          v-model="heightText"
          data-testid="catalog-height-input"
          type="number"
          min="0"
          step="any"
        />
      </div>

      <div class="field">
        <label for="catalog-color-input">{{ t.catalog.colorLabel }}</label>
        <input id="catalog-color-input" v-model="color" data-testid="catalog-color-input" type="color" />
      </div>

      <div class="bead-catalog__form-actions">
        <button type="submit" data-testid="catalog-submit" :disabled="!isValid">
          {{ editingId ? t.catalog.saveButton : t.catalog.addButton }}
        </button>
        <button v-if="editingId" type="button" data-testid="catalog-cancel" @click="resetForm">
          {{ t.catalog.cancelButton }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.bead-catalog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bead-catalog h2 {
  margin: 0;
}

.bead-catalog__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bead-catalog__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bead-catalog__swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 1px solid var(--color-ink);
  border-radius: var(--radius-md);
}

.bead-catalog__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
}

.bead-catalog__form-actions {
  display: flex;
  gap: 8px;
}
</style>
