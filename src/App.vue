<script setup lang="ts">
import { ref } from 'vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import NewPatternForm from './components/NewPatternForm.vue'
import PatternGrid from './components/PatternGrid.vue'
import { createPattern, type CreatePatternInput, type Pattern } from './domain/pattern'
import { loadPattern, savePattern } from './domain/patternStorage'
import { provideI18n } from './i18n/useI18n'

const { t } = provideI18n()

const pattern = ref<Pattern | undefined>(loadPattern())

function onCreatePattern(payload: CreatePatternInput) {
  const created = createPattern(payload)
  savePattern(created)
  pattern.value = created
}
</script>

<template>
  <main>
    <header class="app-header">
      <h1>{{ t.app.title }}</h1>
      <LanguageSwitcher />
    </header>
    <NewPatternForm v-if="!pattern" @submit="onCreatePattern" />
    <PatternGrid v-else :pattern="pattern" />
  </main>
</template>

<style scoped>
main {
  padding: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: var(--color-pink);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

.app-header h1 {
  margin: 0;
  color: var(--color-pink-ink);
}
</style>
