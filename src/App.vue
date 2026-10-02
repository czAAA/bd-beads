<script setup lang="ts">
import AppShell from './components/shell/AppShell.vue'
import { provideAppShell } from './composables/shell/useAppShell'

/**
 * The app is pure composition (ADR 0023): useAppShell wires every composable to the others, and the shell's own
 * components — header, sidebar, canvas panel, bottom bar, phone sheets, dialogs — draw on what it provides.
 */
provideAppShell()
</script>

<template>
  <AppShell />
</template>
