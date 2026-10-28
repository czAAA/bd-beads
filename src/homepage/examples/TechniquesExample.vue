<script setup lang="ts">
import type { Technique } from '../../domain/weave'
import type { Translations } from '../../i18n/translations'
import { useI18n } from '../../i18n/useI18n'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { HEART } from './exampleArt'

/** Techniques (ticket 218): one heart in loom, peyote and brick stitch side by side, each with its beads sitting as its Technique's do. */
const { t } = useI18n()

/** The Techniques shown, in order: each one's label is its own `homepage.examples` key. */
const EXAMPLES: readonly { technique: Technique & keyof Translations['homepage']['examples'] }[] = [
  { technique: 'loom' },
  { technique: 'peyote' },
  { technique: 'brick' },
]
</script>

<template>
  <ExampleFrame>
    <div v-for="item in EXAMPLES" :key="item.technique" class="ex-col" :data-technique="item.technique">
      <BeadPicture :grid="HEART" :technique="item.technique" :zoom="0.55" />
      <span class="ex-label">{{ t.homepage.examples[item.technique] }}</span>
    </div>
  </ExampleFrame>
</template>
