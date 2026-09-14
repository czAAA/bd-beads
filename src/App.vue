<script setup lang="ts">
import { ref } from 'vue'
import NewPatternForm, { type NewPatternSubmitPayload } from './components/NewPatternForm.vue'
import PatternGrid from './components/PatternGrid.vue'
import { createPattern, type Pattern } from './domain/pattern'
import { loadPattern, savePattern } from './domain/patternStorage'

const pattern = ref<Pattern | undefined>(loadPattern())

function onCreatePattern(payload: NewPatternSubmitPayload) {
  const created = createPattern(payload)
  savePattern(created)
  pattern.value = created
}
</script>

<template>
  <main>
    <h1>bd-beads</h1>
    <NewPatternForm v-if="!pattern" @submit="onCreatePattern" />
    <PatternGrid v-else :pattern="pattern" />
  </main>
</template>

<style scoped>
main {
  padding: 24px;
}
</style>
