import type { Report, ReportSent } from '../domain/feedbackReport'

// Sending a Report from the Feedback sheet (ADR 0081, spec 0698): Turnstile's invisible check, rendered when the sheet
// opens, then `POST /api/feedback` on the Worker with its token; and Copy report's clipboard.

/** The Turnstile widget's public site key, the one `wrangler.jsonc` gives both Workers (step H3); not a secret.
 * @internal Its test checks it against `wrangler.jsonc`. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFUZenzE5M2N5bxC'
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** How long Send waits for a token before it says the Report could not be sent. */
const TOKEN_WAIT_MS = 20_000
/** The Worker's own wait for a rate-limited Report (`FEEDBACK_RATE`'s period), when its answer gives none. */
const DEFAULT_RETRY_SECONDS = 60

/** The part of Cloudflare's `window.turnstile` the sheet uses. */
interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

/** Turnstile running in the open sheet: `token` hands out one token (each is good for one request); `dispose` removes
 * the widget when the sheet closes. */
export interface Verification {
  token: () => Promise<string>
  dispose: () => void
}

/** What the Feedback flow needs from outside the page; a test fakes it. */
export interface FeedbackService {
  verify: (container: HTMLElement) => Verification
  send: (report: Report, verification: Verification) => Promise<ReportSent>
  /** Puts the text on the clipboard; false when the browser refuses. */
  copy: (text: string) => Promise<boolean>
}

let script: Promise<TurnstileApi> | undefined

/** Cloudflare's script, loaded once, the first time a sheet opens; a load that fails is tried again next time. */
function loadTurnstile(): Promise<TurnstileApi> {
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    const element = document.createElement('script')
    element.src = TURNSTILE_SCRIPT
    element.async = true
    element.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile
      if (api) resolve(api)
      else reject(new Error('turnstile missing'))
    }
    element.onerror = () => reject(new Error('turnstile unavailable'))
    document.head.append(element)
  }).catch((error: unknown) => {
    script = undefined
    throw error
  })
  return script
}

/** Renders Turnstile into `container` (invisible; it shows only if Cloudflare asks the person something). The sheet
 * asks for one token at a time: Send waits while it is sending. */
function verify(container: HTMLElement): Verification {
  let widgetId: string | undefined
  let api: TurnstileApi | undefined
  let ready: string | undefined
  let failed = false
  let waiting: { resolve: (token: string) => void; reject: (error: Error) => void } | undefined
  let disposed = false

  /** A token is spent once given out: the widget makes the next one, for a retry. */
  const take = (): string | undefined => {
    const token = ready
    ready = undefined
    if (token !== undefined && api && widgetId !== undefined) api.reset(widgetId)
    return token
  }
  const answer = () => {
    if (!waiting) return
    const { resolve, reject } = waiting
    if (ready !== undefined) resolve(take()!)
    else if (failed) reject(new Error('turnstile failed'))
    else return
    waiting = undefined
  }

  const start = () =>
    loadTurnstile().then(
      (loaded) => {
        if (disposed || api) return
        api = loaded
        widgetId = loaded.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: 'interaction-only',
          callback: (token: string) => {
            failed = false
            ready = token
            answer()
          },
          'error-callback': () => {
            failed = true
            answer()
          },
          'expired-callback': () => void take(),
        })
      },
      () => {
        failed = true
        answer()
      },
    )
  void start()

  return {
    token: () => {
      if (ready !== undefined) return Promise.resolve(take()!)
      if (failed) {
        // Asked again after a failure: start the widget over (or load it again) and wait for its next answer.
        failed = false
        if (api && widgetId !== undefined) api.reset(widgetId)
        else void start()
      }
      return new Promise<string>((resolve, reject) => {
        const entry = { resolve, reject }
        waiting = entry
        answer()
        setTimeout(() => {
          if (waiting !== entry) return
          waiting = undefined
          reject(new Error('turnstile timed out'))
        }, TOKEN_WAIT_MS)
      })
    },
    dispose: () => {
      disposed = true
      if (api && widgetId !== undefined) api.remove(widgetId)
    },
  }
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** What the Worker's answer means for the sheet (spec 385's API contract; `worker/src/errors.ts`).
 * @internal Its test reads each answer without a network. */
export async function reportOutcome(response: Response): Promise<ReportSent> {
  if (response.ok) return { sent: true }
  const retryAfter = Number(response.headers.get('Retry-After'))
  const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
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

export const browserFeedback: FeedbackService = { verify, send, copy }
