import type { Report, ReportContext, ReportKind, ReportSent } from '../../domain/feedbackReport'
import type { Locale } from '../../domain/locale'
import { browserAndSystem } from '../../domain/userAgent'
import type { Translations } from '../../i18n/translations'
import type { FeedbackService, Verification } from '../../services/feedback'
import type { MessageTone } from '../ui/useToasts'
import { useDialogs, type Dialogs } from './useDialogs'

/** What an entry point already knows of a bead-color Report (spec 0698): the Bead's Brand and Color catalog, and the
 * code, stored hex and Swatch letter of the swatch it was opened at, where there is one. */
export interface FeedbackPrefill {
  brand?: string
  catalog?: string
  code?: string
  hex?: string
  swatchLetter?: string
  problem?: 'wrong' | 'missing'
}

/** The Feedback sheet's question: its Report kind, the prefill, the context gathered as it opened, and the email to
 * start from. */
export interface FeedbackRequest {
  kind: ReportKind
  prefill: FeedbackPrefill
  context: ReportContext
  email: string
}

/** What the Feedback sheet needs from the app shell, or the Homepage, which has its own registry and toasts. */
export interface FeedbackFlowDeps {
  feedback: FeedbackService
  locale: () => Locale
  messages: () => Translations
  showToast: (id: string, text: string, tone?: MessageTone) => void
  /** The signed-in account's email; none until accounts exist (ticket 78). */
  accountEmail?: () => string | undefined
  /** The dialog registry the sheet opens through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

const PREFILL_CONTEXT = ['brand', 'catalog', 'code', 'hex', 'swatchLetter'] as const

/** What the app attaches to every Report, read as the sheet opens (spec 0698): never the Project or the device id. */
function baseContext(locale: Locale): ReportContext {
  return {
    appVersion: __APP_VERSION__,
    uiLanguage: locale,
    ...browserAndSystem(navigator.userAgent),
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
  }
}

/** The Feedback sheet (ADR 0081, spec 0698): opened from the Menu's Send feedback, the Language row's link or the Bead
 * colors list's foot row with its Report kind; Send posts the Report and a success closes it with a toast. A failure
 * keeps the sheet open: the sheet shows why and offers Copy report. */
export function useFeedbackFlow(deps: FeedbackFlowDeps) {
  const request = (deps.dialogs ?? useDialogs()).question<FeedbackRequest>('feedback')

  function onOpenFeedback(kind: ReportKind, prefill: FeedbackPrefill = {}) {
    const extra = kind === 'bead-color' ? Object.fromEntries(PREFILL_CONTEXT.flatMap((key) => (prefill[key] ? [[key, prefill[key]]] : []))) : {}
    request.value = { kind, prefill, context: { ...baseContext(deps.locale()), ...extra }, email: deps.accountEmail?.() ?? '' }
  }

  function onCloseFeedback() {
    request.value = undefined
  }

  /** Turnstile in the open sheet (spec 0698: rendered as it opens, so the token is ready by Send). */
  let verification: Verification | undefined

  function verifyFeedback(container: HTMLElement): () => void {
    const started = deps.feedback.verify(container)
    verification = started
    return () => {
      started.dispose()
      if (verification === started) verification = undefined
    }
  }

  async function sendReport(report: Report): Promise<ReportSent> {
    if (!verification) return { sent: false, reason: 'failed' }
    const outcome = await deps.feedback.send(report, verification)
    if (outcome.sent) {
      onCloseFeedback()
      deps.showToast('feedback-sent', deps.messages().feedback.sent)
    }
    return outcome
  }

  return {
    feedbackRequest: request,
    onOpenFeedback,
    onCloseFeedback,
    sendReport,
    verifyFeedback,
    copyReport: deps.feedback.copy,
  }
}
