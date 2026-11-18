<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMessage from '../ui/AppMessage.vue'

// An address with no page (ticket 1053), such as a language code the app has none for (`/de/`): a full-page Message
// (Message card) whose one action leads to the Homepage at the main address. The host shows it for every missing
// page (`404.html`, `not_found_handling` in wrangler.jsonc).
defineProps<{ homepage: string }>()
const { t } = useI18n()
</script>

<template>
  <main class="page-not-found" data-testid="page-not-found">
    <AppMessage tone="info" placement="toast" :closable="false">
      <span data-testid="page-not-found-message">{{ t.homepage.notFound }}</span>
      <template #actions>
        <AppButton variant="in-box" size="sm" :href="homepage" data-testid="page-not-found-homepage">
          {{ t.homepage.notFoundHomepage }}
        </AppButton>
      </template>
    </AppMessage>
  </main>
</template>

<style scoped>
.page-not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: var(--space-16);
  background: var(--canvas);
}
</style>
