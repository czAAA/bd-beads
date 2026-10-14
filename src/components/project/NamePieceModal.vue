<script setup lang="ts">
import { ref } from 'vue'
import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import FormField from '../ui/form/FormField.vue'
import TextField from '../ui/form/TextField.vue'

/**
 * Name Piece (ticket 406, ADR 0050): the name of the selected Piece, optional and up to 40 characters like the Maker's
 * name. A named Piece is a Schema; saving an empty field takes the name off. Enter saves, Escape cancels.
 */
const props = defineProps<{ name: string }>()
const emit = defineEmits<{ save: [name: string]; cancel: [] }>()
const { t } = useI18n()

const draft = ref(props.name)
</script>

<template>
  <AppModal :title="t.pieceName.title" size="narrow" data-testid="name-piece-modal" @cancel="emit('cancel')">
    <form id="name-piece-form" @submit.prevent="emit('save', draft)">
      <FormField :label="t.pieceName.label" label-for="piece-name-input" :aside="t.form.optional" :hint="t.pieceName.hint">
        <TextField
          id="piece-name-input"
          v-model="draft"
          type="text"
          :maxlength="MAX_PIECE_NAME"
          data-autofocus
          data-testid="piece-name-input"
        />
      </FormField>
    </form>
    <template #actions>
      <AppButton variant="in-box" data-testid="piece-name-cancel" @click="emit('cancel')">{{ t.pieceName.cancel }}</AppButton>
      <AppButton variant="primary" type="submit" form="name-piece-form" data-testid="piece-name-save">
        {{ t.pieceName.save }}
      </AppButton>
    </template>
  </AppModal>
</template>
