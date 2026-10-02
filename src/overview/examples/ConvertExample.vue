<script setup lang="ts">
import { useI18n } from '../../i18n/useI18n'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { ART_COLORS, HILLS } from './exampleArt'

/** Convert image (ticket 218): a picture drawn here, not borrowed, beside its 6-colour beaded version. */
const { t } = useI18n()
const { B, L, O, Y, S, G, K } = ART_COLORS
</script>

<template>
  <ExampleFrame>
    <div class="ex-col">
      <svg class="convert__picture" width="168" height="126" viewBox="0 0 168 126">
        <defs>
          <linearGradient id="overview-picture-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" :stop-color="B" />
            <stop offset=".45" :stop-color="L" />
            <stop offset=".6" :stop-color="O" />
          </linearGradient>
        </defs>
        <rect width="168" height="126" fill="url(#overview-picture-sky)" />
        <circle cx="121" cy="38" r="15" :fill="Y" />
        <path d="M0 72 C 30 56, 60 86, 90 70 S 140 58, 168 74 V126 H0Z" :fill="S" />
        <path d="M0 88 C 40 76, 70 100, 110 86 S 150 82, 168 92 V126 H0Z" :fill="G" />
        <path d="M0 108 C 50 100, 100 116, 168 104 V126 H0Z" :fill="K" />
      </svg>
      <span class="ex-label">{{ t.overview.examples.picture }}</span>
    </div>
    <svg class="ex-arrow" width="46" height="20" viewBox="0 0 46 20"><path d="M2 12 C 14 4, 28 16, 42 9 M35 4 L43 9 L36 15" /></svg>
    <div class="ex-col">
      <BeadPicture :grid="HILLS" :zoom="0.35" />
      <span class="ex-label">{{ t.overview.examples.sixColors }}</span>
    </div>
  </ExampleFrame>
</template>

<style scoped>
.convert__picture {
  display: block;
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-1);
}
</style>
