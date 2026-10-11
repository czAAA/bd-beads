<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import type { IconName } from '../../components/ui/icons'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { POPPY_PAINTING } from './exampleArt'

/** Project editing (ticket 218): a poppy half painted, Paint active in the toolbar, a Selection frame round the bloom and the next bead of the stem under the brush. */
const TOOLS: IconName[] = ['paint', 'fill', 'select', 'erase']
const SELECTION = { top: 0, left: 2, rows: 9, columns: 9 }
const NEXT_BEAD = { cells: [{ row: 11, column: 6 }], color: null }
</script>

<template>
  <ExampleFrame>
    <div class="editing">
      <div class="editing__tools">
        <span v-for="(tool, i) in TOOLS" :key="tool" class="editing__tool" :class="{ 'editing__tool--on': i === 0 }">
          <AppIcon :name="tool" :size="17" />
        </span>
        <span class="editing__tool"><AppIcon name="undo" :size="17" /></span>
      </div>
      <BeadPicture :grid="POPPY_PAINTING" :zoom="0.8" :selection="SELECTION" :preview="NEXT_BEAD" />
    </div>
  </ExampleFrame>
</template>

<style scoped>
.editing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-12);
}

.editing__tools {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--canvas);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
}

.editing__tool {
  display: grid;
  place-items: center;
  width: 1.875rem;
  height: 1.875rem;
  color: var(--muted);
  border-radius: var(--radius-md);
}

.editing__tool--on {
  color: var(--on-accent);
  background: var(--accent);
}
</style>
