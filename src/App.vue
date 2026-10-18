<script setup lang="ts">
import AppShell from './components/shell/AppShell.vue'
import { provideAppShell } from './composables/shell/useAppShell'

/** The app is pure composition (ADR 0020): useAppShell wires every composable together, and the shell's components
 * draw on what it provides. */
provideAppShell()
</script>

<template>
  <AppShell />
</template>
