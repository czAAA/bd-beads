<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import type { FeedbackRequest } from '../../composables/shell/useFeedbackFlow'
import { EMAIL_MAX, FIELD_MAX, isEmail, NOTE_MAX, parseReport, reportIssue, type Report, type ReportContext, type ReportSent } from '../../domain/feedbackReport'
import { fillBlanks } from '../../domain/fillBlanks'
import { LOCALES, LOCALE_NAMES, type Locale } from '../../domain/locale'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppModal from '../ui/AppModal.vue'
import ChipRadioGroup from '../ui/form/ChipRadioGroup.vue'
import FormField from '../ui/form/FormField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'

// The Feedback sheet (ADR 0081, spec 0698; FeedbackSheet card): one modal, three Report kinds, each with its fields,
// an optional Email and the Also sent block showing the context exactly as sent. Send posts the Report; a failure
// keeps every field, says why and offers Copy report, the Markdown `reportIssue` builds for the Worker too.
const props = defineProps<{
  request: FeedbackRequest
  /** Starts Turnstile in the given element as the sheet opens; returns its removal. */
  verify: (container: HTMLElement) => () => void
  send: (report: Report) => Promise<ReportSent>
  copy: (text: string) => Promise<boolean>
}>()
const emit = defineEmits<{ cancel: [] }>()
const { t } = useI18n()
const words = computed(() => t.value.feedback)

const kind = computed(() => props.request.kind)
const message = ref('')
const language = ref<Locale>(LOCALES.find((code) => code === props.request.context.uiLanguage) ?? 'en')
const shown = ref('')
const shouldSay = ref('')
const note = ref('')
const problem = ref<'wrong' | 'missing'>(props.request.prefill.problem ?? 'wrong')
const code = ref(props.request.prefill.code ?? '')
const looksLike = ref('')
const email = ref(props.request.email)

const brandAndCatalog = computed(() => [props.request.prefill.brand, props.request.prefill.catalog].filter(Boolean).join(', '))

/** The context as sent: a translation's language follows its field. */
const context = computed<ReportContext>(() =>
  kind.value === 'translation' ? { ...props.request.context, language: language.value } : props.request.context,
)

const report = computed<Report>(() => {
  const typedEmail = email.value.trim()
  const shared = { context: context.value, ...(typedEmail ? { email: typedEmail } : {}) }
  switch (kind.value) {
    case 'general':
      return { kind: 'general', fields: { message: message.value }, ...shared }
    case 'translation':
      return { kind: 'translation', fields: { language: language.value, shown: shown.value, shouldSay: shouldSay.value, note: note.value }, ...shared }
    case 'bead-color':
      return {
        kind: 'bead-color',
        fields: {
          problem: problem.value,
          brand: props.request.prefill.brand ?? '',
          catalog: props.request.prefill.catalog ?? '',
          code: code.value,
          looksLike: looksLike.value,
          note: note.value,
        },
        ...shared,
      }
  }
  throw new Error('unknown Report kind')
})

const tried = ref(false)
const errors = computed(() => ({
  message: kind.value === 'general' && !message.value.trim() ? words.value.messageRequired : undefined,
  shown: kind.value === 'translation' && !shown.value.trim() ? words.value.shownRequired : undefined,
  email: email.value.trim() && !isEmail(email.value.trim()) ? words.value.emailInvalid : undefined,
}))
const shownError = (key: keyof typeof errors.value) => (tried.value ? errors.value[key] : undefined)

const title = computed(() => ({ general: words.value.titleGeneral, translation: words.value.titleTranslation, 'bead-color': words.value.titleBeadColor })[kind.value])
const intro = computed(() => ({ general: words.value.introGeneral, translation: words.value.introTranslation, 'bead-color': words.value.introBeadColor })[kind.value])

const languageOptions = LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value], action: { name: () => LOCALE_NAMES[value], chords: [] } }))
const problemOptions = computed(() => [
  { value: 'wrong' as const, label: words.value.wrongColor },
  { value: 'missing' as const, label: words.value.missingColor },
])

/** The Also sent block's rows, in the issue's table order, each value exactly as sent. */
const contextRows = computed(() => {
  const labels: Record<keyof ReportContext, string> = {
    appVersion: words.value.ctxAppVersion,
    uiLanguage: words.value.ctxUiLanguage,
    browser: words.value.ctxBrowser,
    os: words.value.ctxOs,
    viewport: words.value.ctxViewport,
    language: words.value.ctxLanguage,
    brand: words.value.ctxBrand,
    catalog: words.value.ctxCatalog,
    code: words.value.ctxCode,
    hex: words.value.ctxHex,
    swatchLetter: words.value.ctxSwatchLetter,
  }
  return (Object.keys(labels) as (keyof ReportContext)[]).flatMap((key) => {
    const value = context.value[key]
    return value === undefined ? [] : [{ key, label: labels[key], value }]
  })
})
const alsoSentOpen = ref(false)
const alsoSentId = useId()

const sending = ref(false)
const outcome = ref<ReportSent>()
const copied = ref<boolean>()
const failure = computed(() => {
  const result = outcome.value
  if (!result || result.sent) return undefined
  switch (result.reason) {
    case 'off':
      return fillBlanks(words.value.off, { minutes: Math.ceil(result.retryAfterSeconds / 60) })
    case 'rate-limited':
      return fillBlanks(words.value.rateLimited, { seconds: result.retryAfterSeconds })
    case 'offline':
      return words.value.offline
    case 'failed':
      return words.value.failed
  }
  return undefined
})

async function submit() {
  if (sending.value) return
  tried.value = true
  if (!parseReport(report.value)) return
  sending.value = true
  copied.value = undefined
  try {
    outcome.value = await props.send(report.value)
  } finally {
    sending.value = false
  }
}

/** Copy report: the issue as it would have been posted, its title as the first line. */
async function copyReport() {
  const issue = reportIssue(report.value)
  copied.value = await props.copy(`# ${issue.title}\n\n${issue.body}\n`)
}

const verifyEl = ref<HTMLElement>()
let stopVerifying: (() => void) | undefined
onMounted(() => {
  if (verifyEl.value) stopVerifying = props.verify(verifyEl.value)
})
onBeforeUnmount(() => stopVerifying?.())
</script>

<template>
  <AppModal :title="title" size="panel" data-testid="feedback-sheet" :data-kind="kind" @cancel="emit('cancel')">
    <form id="feedback-sheet-form" class="feedback-sheet__form" novalidate @submit.prevent="submit">
      <p class="feedback-sheet__intro">{{ intro }}</p>
      <FormField v-if="kind === 'general'" :label="words.message" label-for="feedback-message" :error="shownError('message')">
        <TextField
          id="feedback-message"
          v-model="message"
          multiline
          class="feedback-sheet__message"
          :maxlength="NOTE_MAX"
          :invalid="!!shownError('message')"
          data-autofocus
          data-testid="feedback-message"
        />
      </FormField>

      <template v-if="kind === 'translation'">
        <FormField :label="words.language" label-id="feedback-language-label">
          <ChipRadioGroup v-model="language" :options="languageOptions" labelledby="feedback-language-label" data-testid="feedback-language" />
        </FormField>
        <FormField :label="words.shown" label-for="feedback-shown" :error="shownError('shown')">
          <TextField id="feedback-shown" v-model="shown" type="text" :maxlength="FIELD_MAX" :invalid="!!shownError('shown')" data-autofocus data-testid="feedback-shown" />
        </FormField>
        <FormField :label="words.shouldSay" label-for="feedback-should-say" :aside="t.form.optional">
          <TextField id="feedback-should-say" v-model="shouldSay" type="text" :maxlength="FIELD_MAX" data-testid="feedback-should-say" />
        </FormField>
      </template>

      <template v-if="kind === 'bead-color'">
        <FormField :label="words.problem" label-id="feedback-problem-label">
          <SegmentedControl v-model="problem" :options="problemOptions" labelledby="feedback-problem-label" data-testid="feedback-problem" />
        </FormField>
        <FormField :label="words.brandCatalog" label-id="feedback-brand-label">
          <p class="feedback-sheet__fixed" aria-describedby="feedback-brand-label" data-testid="feedback-brand">{{ brandAndCatalog }}</p>
        </FormField>
        <FormField :label="words.code" label-for="feedback-code" :aside="t.form.optional">
          <TextField id="feedback-code" v-model="code" type="text" :maxlength="FIELD_MAX" autocomplete="off" data-testid="feedback-code" />
        </FormField>
        <FormField :label="words.looksLike" label-for="feedback-looks-like" :aside="t.form.optional" :hint="words.looksLikeHint">
          <TextField id="feedback-looks-like" v-model="looksLike" type="text" :maxlength="FIELD_MAX" autocomplete="off" data-testid="feedback-looks-like" />
        </FormField>
      </template>

      <FormField v-if="kind !== 'general'" :label="words.note" label-for="feedback-note" :aside="t.form.optional">
        <TextField id="feedback-note" v-model="note" multiline class="feedback-sheet__note" :maxlength="NOTE_MAX" data-testid="feedback-note" />
      </FormField>

      <FormField :label="words.email" label-for="feedback-email" :aside="t.form.optional" :hint="words.emailHint" :error="shownError('email')">
        <TextField
          id="feedback-email"
          v-model="email"
          type="email"
          autocomplete="email"
          :maxlength="EMAIL_MAX"
          :invalid="!!shownError('email')"
          data-testid="feedback-email"
        />
      </FormField>

      <div class="feedback-sheet__also">
        <AppButton
          variant="in-box"
          size="sm"
          :trailing-icon="alsoSentOpen ? 'chevron-up' : 'chevron-down'"
          :aria-expanded="alsoSentOpen"
          :aria-controls="alsoSentId"
          data-testid="feedback-also-sent-toggle"
          @click="alsoSentOpen = !alsoSentOpen"
        >
          {{ words.alsoSent }}
        </AppButton>
        <div v-if="alsoSentOpen" :id="alsoSentId" class="feedback-sheet__sent" data-testid="feedback-also-sent">
          <dl class="feedback-sheet__rows">
            <div v-for="row in contextRows" :key="row.key" class="feedback-sheet__row" :data-key="row.key">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <p class="feedback-sheet__never">{{ words.alsoSentNote }}</p>
        </div>
      </div>
    </form>

    <AppMessage v-if="failure" tone="danger" placement="notice" :closable="false" data-testid="feedback-failed">
      {{ failure }}
      <template #actions>
        <AppButton variant="link" data-testid="feedback-copy" @click="copyReport">{{ words.copyReport }}</AppButton>
      </template>
    </AppMessage>
    <p v-if="copied !== undefined" class="feedback-sheet__copied" role="status" data-testid="feedback-copied">
      {{ copied ? words.copied : words.copyFailed }}
    </p>
    <!-- Turnstile's widget (invisible unless Cloudflare asks the person something). -->
    <div ref="verifyEl" class="feedback-sheet__verify" />

    <template #actions>
      <AppButton variant="in-box" data-testid="feedback-cancel" @click="emit('cancel')">{{ words.cancel }}</AppButton>
      <AppButton variant="primary" type="submit" form="feedback-sheet-form" :disabled="sending" data-testid="feedback-send">
        {{ sending ? words.sending : words.send }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.feedback-sheet__intro {
  font: var(--type-body);
  color: var(--body);
}

.feedback-sheet__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

/* Message and Note start this tall and can be pulled taller (FeedbackSheet card). */
.feedback-sheet__form :deep(.feedback-sheet__message) {
  min-height: var(--feedback-message-height);
}

.feedback-sheet__form :deep(.feedback-sheet__note) {
  min-height: var(--feedback-note-height);
}

/* Brand and catalog are what the Bead is: read, not typed (FeedbackSheet card). */
.feedback-sheet__fixed {
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.feedback-sheet__also {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-8);
}

.feedback-sheet__sent {
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-8) var(--space-12);
  background: var(--surface);
  border-radius: var(--radius-md);
}

.feedback-sheet__rows {
  margin: 0;
}

.feedback-sheet__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2) var(--space-12);
  padding: var(--space-2) 0;
  font: var(--type-meta);
}

.feedback-sheet__row dt {
  color: var(--muted);
}

.feedback-sheet__row dd {
  margin: 0;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.feedback-sheet__never {
  margin: var(--space-8) 0 0;
  font: var(--type-small);
  color: var(--muted);
}

.feedback-sheet__copied {
  margin: 0;
  font: var(--type-small);
  color: var(--body);
}

.feedback-sheet__verify:empty {
  display: none;
}
</style>
