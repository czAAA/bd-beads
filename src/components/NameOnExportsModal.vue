<script setup lang="ts">
import { ref } from 'vue'
import { MAX_MAKER_NAME } from '../domain/makerName'
import { useI18n } from '../i18n/useI18n'
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'
import FormField from './form/FormField.vue'
import TextField from './form/TextField.vue'

/**
 * Name on exports (ticket 161; NameOnExports card): the maker's name for the PDF and PNG exports, optional and up to 40
 * characters, kept on this device. Enter saves, Escape cancels, and saving an empty field clears the name.
 */
const props = defineProps<{ name: string }>()
const emit = defineEmits<{ save: [name: string]; cancel: [] }>()
const { t } = useI18n()

const draft = ref(props.name)
</script>

<template>
  <AppModal :title="t.saveBox.nameOnExports" size="narrow" data-testid="name-on-exports-modal" @cancel="emit('cancel')">
    <form id="name-on-exports-form" class="name-on-exports" @submit.prevent="emit('save', draft)">
      <FormField :label="t.saveBox.yourName" label-for="maker-name-input" :aside="t.form.optional" :hint="t.saveBox.nameHint">
        <TextField
          id="maker-name-input"
          v-model="draft"
          type="text"
          autocomplete="name"
          :maxlength="MAX_MAKER_NAME"
          data-autofocus
          data-testid="maker-name-input"
        />
      </FormField>
    </form>
    <template #actions>
      <AppButton variant="in-box" data-testid="maker-name-cancel" @click="emit('cancel')">{{ t.saveBox.cancelName }}</AppButton>
      <AppButton variant="primary" type="submit" form="name-on-exports-form" data-testid="maker-name-save">
        {{ t.saveBox.saveName }}
      </AppButton>
    </template>
  </AppModal>
</template>
