<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_PROJECT_NAME, normalizeProjectName } from '../../domain/projectName'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/form/FormField.vue'
import TextField from '../ui/form/TextField.vue'

/**
 * Duplicate Project (ProjectPanel and ConfirmDialogs cards, ticket 443): asks for the copy's name, suggesting the current
 * name and the next free number, and says the copy keeps everything, Row progress included. Enter or Duplicate makes the
 * copy; an empty name is refused. Cancel changes nothing.
 */
const props = defineProps<{ suggested: string }>()
const emit = defineEmits<{ confirm: [name: string]; cancel: [] }>()
const { t } = useI18n()

const draft = ref(props.suggested)
const tried = ref(false)
const empty = computed(() => !normalizeProjectName(draft.value))

function submit() {
  tried.value = true
  if (!empty.value) emit('confirm', draft.value)
}
</script>

<template>
  <AppModal :title="t.panels.project.duplicateTitle" size="narrow" data-testid="duplicate-project-modal" @cancel="emit('cancel')">
    <p class="duplicate-note">{{ t.panels.project.duplicateNote }}</p>
    <form id="duplicate-project-form" @submit.prevent="submit">
      <FormField
        :label="t.panels.project.nameField"
        label-for="duplicate-name-input"
        :hint="t.panels.project.duplicateHint"
        :error="tried && empty ? t.panels.project.nameRequired : undefined"
      >
        <TextField
          id="duplicate-name-input"
          v-model="draft"
          type="text"
          :maxlength="MAX_PROJECT_NAME"
          :invalid="tried && empty"
          data-autofocus
          data-testid="duplicate-name-input"
        />
      </FormField>
    </form>
    <template #actions>
      <AppButton variant="in-box" data-testid="duplicate-cancel" @click="emit('cancel')">{{ t.panels.project.cancel }}</AppButton>
      <AppButton variant="primary" type="submit" form="duplicate-project-form" data-testid="duplicate-confirm">
        {{ t.panels.project.duplicate }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.duplicate-note {
  margin: 0 0 var(--space-12);
  font: var(--type-body);
  color: var(--body);
}
</style>
