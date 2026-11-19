import type { Report, ReportSent } from '../domain/feedbackReport'
import { offline, retryAfterSeconds } from './backendAnswer'
import { verify, type Verification } from './turnstile'

// Sending a Report from the Feedback sheet (ADR 0081, spec 0698): Turnstile's invisible check (turnstile.ts), rendered
// when the sheet opens, then `POST /api/feedback` on the Worker with its token; and Copy report's clipboard.

/** The Worker's own wait for a rate-limited Report (`FEEDBACK_RATE`'s period), when its answer gives none. */
const DEFAULT_RETRY_SECONDS = 60

/** What the Feedback flow needs from outside the page; a test fakes it. */
export interface FeedbackService {
  verify: (container: HTMLElement) => Verification
  send: (report: Report, verification: Verification) => Promise<ReportSent>
  /** Puts the text on the clipboard; false when the browser refuses. */
  copy: (text: string) => Promise<boolean>
}

/** What the Worker's answer means for the sheet (spec 385's API contract; `worker/src/errors.ts`).
 * @internal Its test reads each answer without a network. */
export async function reportOutcome(response: Response): Promise<ReportSent> {
  if (response.ok) return { sent: true }
  const wait = retryAfterSeconds(response)
  if (response.status === 429) return { sent: false, reason: 'rate-limited', retryAfterSeconds: wait ?? DEFAULT_RETRY_SECONDS }
  if (response.status === 503) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined
    if (body?.error === 'feature-off' && wait) return { sent: false, reason: 'off', retryAfterSeconds: wait }
  }
  return { sent: false, reason: 'failed' }
}

/** Posts the Report with a Turnstile token; a network that fails is offline when the browser says so. */
async function send(report: Report, verification: Verification): Promise<ReportSent> {
  if (offline()) return { sent: false, reason: 'offline' }
  try {
    const token = await verification.token()
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Turnstile-Token': token },
      body: JSON.stringify(report),
    })
    return await reportOutcome(response)
  } catch {
    return { sent: false, reason: offline() ? 'offline' : 'failed' }
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const browserFeedback: FeedbackService = { verify: (container) => verify(container), send, copy }
