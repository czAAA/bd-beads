<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMessage from '../ui/AppMessage.vue'

// The Projects saved on this device couldn't be opened (spec 1018, ADR 0094): a full-page Message (Message card) with its one
// action, Reload. The old copy is never opened in its place. `list` is the same message inside the Homepage's Saved Projects.
defineProps<{ list?: boolean }>()
const { t } = useI18n()
const reload = () => window.location.reload()
</script>

<template>
  <main :class="list ? 'library-unopened library-unopened--list' : 'library-unopened'" data-testid="library-unopened">
    <AppMessage tone="danger" :placement="list ? 'notice' : 'toast'" :closable="false">
      <span data-testid="library-unopened-message">{{ t.storage.libraryUnopened }}</span>
      <template #actions>
        <AppButton variant="in-box" size="sm" data-testid="library-unopened-reload" @click="reload">
          {{ t.storage.reload }}
        </AppButton>
      </template>
    </AppMessage>
  </main>
</template>

<style scoped>
.library-unopened {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: var(--space-16);
  background: var(--canvas);
}

.library-unopened--list {
  min-height: 0;
  padding: var(--space-8) 0;
  background: none;
}
</style>
