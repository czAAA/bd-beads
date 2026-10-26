<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { beadLabel, uniqueBy, type Bead } from '../../domain/beads'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import MenuButton from '../ui/MenuButton.vue'

// The one way to choose a Bead (ticket 535; BeadPicker card): collapsed to the current Bead and a hint, opened to Brand,
// Form factor, then Bead size. Only a whole Bead is reported. Replace Bead passes the Project's own copy as `current`.
const props = withDefaults(
  defineProps<{
    /** The id of the Bead the choice stands on. */
    modelValue: string
    /** What can be picked: the catalog's current Beads. */
    beads: readonly Bead[]
    /** The Bead the choice stands on when it may sit outside `beads`: a Project's own copy. */
    current?: Bead
    /** `current` differs from the catalog's Bead of its id: it shows with a postfix, and the catalog's one is offered. */
    outdated?: boolean
    /** Closes after a pick, for a choice that asks for a confirmation next. */
    closeOnPick?: boolean
    /** Leaves out the Bead's name, where the caller already shows it. */
    compact?: boolean
    testid?: string
  }>(),
  { current: undefined, outdated: false, closeOnPick: false, compact: false, testid: 'bead-picker' },
)
const emit = defineEmits<{ 'update:modelValue': [beadId: string] }>()

const { t } = useI18n()
const open = ref(false)

const entries = computed(() => (props.current && !props.beads.some((bead) => bead.id === props.current!.id) ? [...props.beads, props.current] : props.beads))
const selected = computed(() => entries.value.find((bead) => bead.id === props.modelValue))

const brandId = ref<string>()
const formFactorId = ref<string>()
const sizeId = ref<string>()

function reset() {
  brandId.value = selected.value?.brand.id
  formFactorId.value = selected.value?.formFactor.id
  sizeId.value = selected.value?.id
}
reset()
watch(() => props.modelValue, reset)
watch(open, (isOpen) => isOpen && reset())

const brands = computed(() => uniqueBy(entries.value, (bead) => bead.brand.id))
const formFactors = computed(() => uniqueBy(entries.value.filter((bead) => bead.brand.id === brandId.value), (bead) => bead.formFactor.id))
const sizes = computed(() => entries.value.filter((bead) => bead.brand.id === brandId.value && bead.formFactor.id === formFactorId.value))

const ownSizeIsSaved = (bead: Bead) => props.outdated && bead.id === props.current?.id

const summary = computed(() => {
  const own = props.current ?? selected.value
  if (!own) return ''
  const label = beadLabel(own, t.value.formFactors)
  return props.outdated ? `${label} ${t.value.replaceBead.outdatedPostfix}` : label
})

const formFactorName = (bead: Bead) => t.value.formFactors[bead.formFactor.nameKey]
const brandTriggerLabel = computed(() => brands.value.find((bead) => bead.brand.id === brandId.value)?.brand.name ?? t.value.form.beadPicker.choose)
const formFactorTriggerLabel = computed(() => {
  const bead = formFactors.value.find((candidate) => candidate.formFactor.id === formFactorId.value)
  return bead ? formFactorName(bead) : t.value.form.beadPicker.choose
})
const sizeTriggerLabel = computed(() => sizes.value.find((bead) => bead.id === sizeId.value)?.size ?? t.value.form.beadPicker.choose)

/** A step with one choice takes it, so a Brand with one Form factor of one size is a whole Bead at once. */
function settle() {
  if (!formFactorId.value && formFactors.value.length === 1) formFactorId.value = formFactors.value[0]!.formFactor.id
  if (!sizeId.value && sizes.value.length === 1) sizeId.value = sizes.value[0]!.id
  const bead = entries.value.find((candidate) => candidate.id === sizeId.value)
  if (!bead) return
  if (bead.id !== props.modelValue || props.outdated) emit('update:modelValue', bead.id)
  if (props.closeOnPick) open.value = false
}

function pickBrand(id: string) {
  if (id === brandId.value) return
  brandId.value = id
  formFactorId.value = undefined
  sizeId.value = undefined
  settle()
}

function pickFormFactor(id: string) {
  if (id === formFactorId.value) return
  formFactorId.value = id
  sizeId.value = undefined
  settle()
}

function pickSize(id: string) {
  sizeId.value = id
  settle()
}
</script>

<template>
  <div class="bead-picker" :data-testid="testid">
    <div class="bead-picker__summary">
      <div class="bead-picker__current">
        <span v-if="!compact" class="bead-picker__name" :data-testid="`${testid}-current`">{{ summary }}</span>
        <span class="bead-picker__hint">{{ t.form.beadPicker.hint }}</span>
      </div>
      <AppButton
        variant="in-box"
        size="sm"
        :trailing-icon="open ? 'chevron-up' : 'chevron-down'"
        :aria-expanded="open"
        :data-testid="`${testid}-toggle`"
        @click="open = !open"
      >
        {{ open ? t.form.beadPicker.close : t.form.beadPicker.change }}
      </AppButton>
    </div>

    <div v-if="open" class="bead-picker__steps" :data-testid="`${testid}-steps`">
      <div class="bead-picker__step">
        <span class="bead-picker__step-label">{{ t.form.beadPicker.brand }}</span>
        <MenuButton variant="in-box" :label="brandTriggerLabel" :data-testid="`${testid}-brand`">
          <AppMenuItem
            v-for="bead in brands"
            :key="bead.brand.id"
            :chosen="bead.brand.id === brandId"
            :data-testid="`${testid}-brand-${bead.brand.id}`"
            @select="pickBrand(bead.brand.id)"
          >
            {{ bead.brand.name }}
          </AppMenuItem>
        </MenuButton>
      </div>

      <div v-if="brandId" class="bead-picker__step">
        <span class="bead-picker__step-label">{{ t.form.beadPicker.formFactor }}</span>
        <MenuButton variant="in-box" :label="formFactorTriggerLabel" :data-testid="`${testid}-form-factor`">
          <AppMenuItem
            v-for="bead in formFactors"
            :key="bead.formFactor.id"
            :chosen="bead.formFactor.id === formFactorId"
            :data-testid="`${testid}-form-factor-${bead.formFactor.id}`"
            @select="pickFormFactor(bead.formFactor.id)"
          >
            {{ formFactorName(bead) }}
          </AppMenuItem>
        </MenuButton>
      </div>

      <div v-if="formFactorId" class="bead-picker__step">
        <span class="bead-picker__step-label">{{ t.form.beadPicker.size }}</span>
        <MenuButton variant="in-box" :label="sizeTriggerLabel" :data-testid="`${testid}-size`">
          <template v-for="bead in sizes" :key="bead.id">
            <AppMenuItem v-if="ownSizeIsSaved(bead) && current" disabled current :data-testid="`${testid}-saved`">
              {{ `${current.size} ${t.replaceBead.outdatedPostfix}` }}
            </AppMenuItem>
            <AppMenuItem
              :chosen="bead.id === sizeId && !ownSizeIsSaved(bead)"
              :data-testid="`${testid}-size-${bead.id}`"
              @select="pickSize(bead.id)"
            >
              {{ bead.size }}
            </AppMenuItem>
          </template>
        </MenuButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bead-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
}

.bead-picker__summary {
  display: flex;
  gap: var(--space-8);
  align-items: center;
  justify-content: space-between;
}

.bead-picker__current {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bead-picker__name {
  font: var(--type-control);
  color: var(--ink);
  overflow-wrap: anywhere;
}

.bead-picker__hint {
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.bead-picker__steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: var(--space-8);
}

.bead-picker__step {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.bead-picker__step-label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}
</style>
