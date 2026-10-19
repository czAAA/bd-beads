<script setup lang="ts">
import { OVERVIEW_TECHNIQUES } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { HEART } from './exampleArt'

/** Techniques (ticket 218): one heart in loom, peyote and brick stitch side by side, each with its beads sitting as its Technique's do. */
const { t } = useI18n()
</script>

<template>
  <ExampleFrame>
    <div v-for="item in OVERVIEW_TECHNIQUES" :key="item.technique" class="ex-col" :data-technique="item.technique">
      <BeadPicture :grid="HEART" :technique="item.technique" :zoom="0.55" />
      <span class="ex-label">{{ t.overview.examples[item.label] }}</span>
    </div>
  </ExampleFrame>
</template>
