<script setup lang="ts">
import AppButton from '../ui/AppButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'

// File (tickets 1121, 1133; ExportPanel card): the export rows' button that saves the Project's .openbeads file by the
// Save Project file action (ADR 0090), so its Tooltip name and Ctrl/⌘ S are the action's. With a Frame or without.
const emit = defineEmits<{ 'save-project-file': [] }>()

const { t } = useI18n()
const saveFile = controlAction('save-project-file')
</script>

<template>
  <AppButton
    variant="accent-2"
    :action="saveFile"
    :tooltip="{ body: t.frame.exportProjectFileBody }"
    :aria-label="`${saveFile.name(t)}, ${t.frame.exportProjectFileBody}`"
    data-testid="export-project-file"
    @click="emit('save-project-file')"
  >
    {{ t.frame.exportProjectFile }}
  </AppButton>
</template>
