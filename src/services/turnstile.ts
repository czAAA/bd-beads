// Cloudflare's Turnstile check, shared by the Feedback sheet and the Sign in Subpanel (ADR 0081, ticket 0078): the
// script loads the first time either opens, so a person who opens neither makes no outside request.

/** The Turnstile widget's public site key, the one `wrangler.jsonc` gives both Workers (step H3); not a secret.
 * @internal Its test checks it against `wrangler.jsonc`. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFUZenzE5M2N5bxC'
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** How long a request waits for a token before it is said to have failed. */
const TOKEN_WAIT_MS = 20_000

/** The part of Cloudflare's `window.turnstile` the app uses. */
interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

/** Turnstile running in an open sheet or Subpanel: `token` hands out one token (each is good for one request);
 * `dispose` removes the widget when it closes. */
export interface Verification {
  token: () => Promise<string>
  dispose: () => void
}

let script: Promise<TurnstileApi> | undefined

/** Cloudflare's script, loaded once, the first time a check is rendered; a load that fails is tried again next time. */
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

/** What a form asks of its check besides a token. */
export interface VerifyOptions {
  /** Names the form, where its route checks it (sign-in): a token solved for another form is refused. */
  action?: string
  /** Told as Cloudflare's widget starts asking the person something, and as it is done. */
  onAsks?: (asking: boolean) => void
}

/** Renders Turnstile into `container` (invisible; it shows only if Cloudflare asks the person something). One token is
 * asked for at a time. */
export function verify(container: HTMLElement, { action, onAsks }: VerifyOptions = {}): Verification {
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
          ...(action ? { action } : {}),
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
          'before-interactive-callback': () => onAsks?.(true),
          'after-interactive-callback': () => onAsks?.(false),
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
