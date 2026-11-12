<script setup lang="ts">
import AppButton from '../components/ui/AppButton.vue'
import { SOURCE_URL } from '../data/sourceLink'
import { useI18n } from '../i18n/useI18n'

/** What Open source and Say hello do on the coffee screen (ticket 0880), in an open chip or a phone's row: View the
 * source opens the source in a new tab; Send feedback only asks for the Feedback sheet, which the page opens. */
defineProps<{ of: 'openSource' | 'sayHello' }>()
const emit = defineEmits<{ feedback: [] }>()
const { t } = useI18n()
</script>

<template>
  <AppButton v-if="of === 'openSource'" size="sm" trailing-icon="external" :href="SOURCE_URL" data-testid="homepage-coffee-source">{{ t.homepage.coffee.source }}</AppButton>
  <AppButton v-else size="sm" data-testid="homepage-send-feedback" @click="emit('feedback')">{{ t.panels.menu.sendFeedback }}</AppButton>
</template>
