<script setup lang="ts">
import PanelItem from '../shell/PanelItem.vue'
import AppButton from '../ui/AppButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'

// File (tickets 1121, 1133; ExportPanel card): the export rows' button that saves the Project's .openbeads file by the
// Save Project file action (ADR 0090), so its Tooltip name and Ctrl/⌘ S are the action's. With a Frame or without.
/** A row of the expanded sheet's rail (ticket 1260) in place of the button. */
defineProps<{ row?: boolean }>()
const emit = defineEmits<{ 'save-project-file': [] }>()

const { t } = useI18n()
const saveFile = controlAction('save-project-file')
</script>

<template>
  <PanelItem v-if="row" :name="saveFile.name(t)" :body="t.frame.exportProjectFileBody" data-testid="export-project-file" @select="emit('save-project-file')">
    {{ t.frame.exportProjectFile }}
  </PanelItem>
  <AppButton
    v-else
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
