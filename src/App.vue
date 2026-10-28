<script setup lang="ts">
import AppShell from './components/shell/AppShell.vue'
import { provideAppShell } from './composables/shell/useAppShell'

/** The app is pure composition (ADR 0020): useAppShell wires every composable together, and each part of the shell
 * draws on its own context (ticket 0618). */
provideAppShell()
</script>

<template>
  <AppShell />
</template>
