<script setup lang="ts">
import { computed, ref } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import { MAX_PROJECT_NAME, normalizeProjectName } from '../../domain/projectName'
import { useI18n } from '../../i18n/useI18n'
import FormField from '../ui/form/FormField.vue'
import TextField from '../ui/form/TextField.vue'
import EditableLine from './EditableLine.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// The Project's Name and Maker's name, shared by New Project and the Project panel (tickets 182, 554, 568). By default
// two always-open fields (the form); `inline` shows each as a line with a pencil that swaps in a field, saved at once,
// and refuses an empty Name. Either way a change is `update:name` or `update:makerName`.
const props = defineProps<{
  /** What the Name field shows while empty: the chosen Bead, as the form's hint. */
  namePlaceholder?: string
  inline?: boolean
}>()
const name = defineModel<string>('name', { required: true })
const makerName = defineModel<string>('makerName', { required: true })

const { t } = useI18n()
const rename = controlAction('rename-project')
const renameLabel = computed(() => fillBlanks(t.value.panels.project.rename, { name: name.value }))

const nameField = ref<InstanceType<typeof TextField>>()

/** Focuses and selects the Name (ticket 181), to encourage naming; on a touch device it waits for a tap, so the
 * keyboard stays down (ticket 515). */
function focusName() {
  if (!props.inline) nameField.value?.focus({ select: true })
}
defineExpose({ focusName })
</script>

<template>
  <div v-if="inline" class="names-section names-section--inline" data-testid="names-section">
    <EditableLine
      :label="t.panels.project.nameLabel"
      :value="name"
      :edit-label="renameLabel"
      :edit-tooltip="rename.body?.(t)"
      :maxlength="MAX_PROJECT_NAME"
      :required-message="t.panels.project.nameRequired"
      :normalize="normalizeProjectName"
      testid="project-name"
      @save="name = $event"
    />
    <EditableLine
      small
      :label="t.panels.project.makerLabel"
      :value="makerName"
      :edit-label="t.panels.project.changeMaker"
      :empty-text="t.panels.project.addMaker"
      :placeholder="t.saveBox.yourName"
      :maxlength="MAX_MAKER_NAME"
      :normalize="(raw) => raw.trim()"
      testid="project-maker"
      @save="makerName = $event"
    />
  </div>
  <div v-else class="names-section" data-testid="names-section">
    <FormField :label="t.form.nameLabel" label-for="name-input" :aside="t.form.optional">
      <TextField id="name-input" ref="nameField" v-model="name" data-testid="name-input" type="text" :placeholder="namePlaceholder" />
    </FormField>

    <!-- This Project's own maker's name (ticket 182): blank by default, overriding the device-wide one only if set. -->
    <FormField :label="t.form.makerNameLabel" label-for="maker-name-input" :aside="t.form.optional">
      <TextField
        id="maker-name-input"
        v-model="makerName"
        data-testid="maker-name-input"
        type="text"
        autocomplete="name"
        :maxlength="MAX_MAKER_NAME"
        :placeholder="t.form.makerNamePlaceholder"
      />
    </FormField>
  </div>
</template>

<style scoped>
.names-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.names-section--inline {
  gap: 0;
}
</style>
