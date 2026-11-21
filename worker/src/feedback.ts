import {
  parseReport,
  reportIssue,
  SCREENSHOT_MAX_BYTES,
  screenshotTypeOf,
  type ReportScreenshot,
  type ScreenshotLink,
  type ScreenshotType,
} from '../../src/domain/feedbackReport'
import type { Route } from './api'
import { readJson } from './body'
import { ApiError, json } from './errors'
import { FEATURE_OFF_RETRY_SECONDS } from './features'
import { takeReport } from './feedbackDay'
import { rateLimit, sizeCap, turnstile } from './guards'

/** Not a tuning knob: a valid Report is at most about 7,000 characters (domain/feedbackReport.ts's limits) plus one
 * screenshot of `SCREENSHOT_MAX_BYTES` as base64 (about 410 KB, ticket 1179), so this only keeps a flood's body out of
 * memory. */
const FEEDBACK_BODY_CAP_BYTES = 512 * 1024

const EXTENSION = { 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const

/** The screenshot's real type, checked by what they are, never by the type the app declared (ticket 1179): `400` for
 * anything that isn't a JPEG or WebP, `413` past the cap. */
function checkScreenshot(screenshot: ReportScreenshot): ScreenshotType {
  // The base64 string is bounded by the body cap; its decoded size is checked before it is decoded.
  const padding = screenshot.data.endsWith('==') ? 2 : screenshot.data.endsWith('=') ? 1 : 0
  if ((screenshot.data.length * 3) / 4 - padding > SCREENSHOT_MAX_BYTES) {
    throw new ApiError('too-large', { cap: SCREENSHOT_MAX_BYTES })
  }
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(screenshot.data), (char) => char.charCodeAt(0))
  } catch {
    throw new ApiError('bad-request')
  }
  if (bytes.length > SCREENSHOT_MAX_BYTES) throw new ApiError('too-large', { cap: SCREENSHOT_MAX_BYTES })
  const type = screenshotTypeOf(bytes)
  if (type === null) throw new ApiError('bad-request')
  return type
}

function githubHeaders(env: { GITHUB_TOKEN?: string; WORKER_NAME: string }): Record<string, string> {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    // GitHub refuses a request without one.
    'User-Agent': `bd-beads-${env.WORKER_NAME}`,
  }
}

/** Commits the screenshot to `feedback/` in the docs repo under a random name (nobody can guess it, two never
 * collide), and returns its link; a failure is logged and the Report is posted without it (ticket 1179). */
async function storeScreenshot(
  env: { GITHUB_TOKEN?: string; FEEDBACK_REPO?: string; WORKER_NAME: string },
  screenshot: { data: string; type: ScreenshotType },
): Promise<ScreenshotLink> {
  const path = `feedback/${crypto.randomUUID()}.${EXTENSION[screenshot.type]}`
  const base = `https://github.com/${env.FEEDBACK_REPO}/`
  try {
    const response = await fetch(`https://api.github.com/repos/${env.FEEDBACK_REPO}/contents/${path}`, {
      method: 'PUT',
      headers: githubHeaders(env),
      body: JSON.stringify({ message: `Screenshot for a Report (${env.WORKER_NAME})`, content: screenshot.data }),
    })
    if (response.status !== 201) {
      console.error(`feedback: screenshot github ${response.status}`)
      return {}
    }
    const url = ((await response.json()) as { content?: { html_url?: unknown } }).content?.html_url
    return typeof url === 'string' && url.startsWith(base) ? { url } : { url: `${base}blob/HEAD/${path}` }
  } catch (error) {
    console.error('feedback: screenshot not stored', error)
    return {}
  }
}

/** `POST /api/feedback` (ADR 0081, spec 0698): a Report becomes one issue in `FEEDBACK_REPO`, built here from its
 * fields, never from a client's title or labels; the dev Worker's are labelled `dev`. Every GitHub failure is `502
 * feedback-failed`, with no retry; past the day's limit (ticket 1051) it is `503 feature-off`, and nothing is posted. */
export const feedbackRoute: Route = {
  method: 'POST',
  path: '/api/feedback',
  feature: 'feedback',
  // Ticket 1024: the per-address limit first, so a flood from one address never reaches the verifier; the overall one
  // after Turnstile, so it counts only Reports with a confirmed token and made-up ones can't shut everyone out.
  guards: [
    rateLimit({ binding: 'FEEDBACK_RATE', periodSeconds: 60 }),
    turnstile(),
    rateLimit({ binding: 'FEEDBACK_RATE_ALL', periodSeconds: 60 }, () => 'all'),
    sizeCap(() => FEEDBACK_BODY_CAP_BYTES),
  ],
  async handler(rc) {
    const report = parseReport(await readJson(rc))
    if (!report) throw new ApiError('bad-request')
    const { env } = rc
    // Checked before anything is posted or counted: a bad picture refuses the whole Report.
    const stored = report.screenshot && { data: report.screenshot.data, type: checkScreenshot(report.screenshot) }
    if (!env.GITHUB_TOKEN || !env.FEEDBACK_REPO) {
      console.error('feedback: no GITHUB_TOKEN or FEEDBACK_REPO')
      throw new ApiError('feedback-failed')
    }
    // Ticket 1051: the day's ceiling, counted only for a Report that passed every guard and is shaped as one. Past it
    // the answer is a switched-off feature's, so the sheet keeps the text and offers Copy report.
    if (!(await takeReport(env, new Date()))) {
      console.error('feedback: past FEEDBACK_DAILY_LIMIT')
      throw new ApiError('feature-off', { feature: 'feedback' }, FEATURE_OFF_RETRY_SECONDS)
    }
    const issue = reportIssue(report, stored && (await storeScreenshot(env, stored)))
    if (env.WORKER_NAME === 'dev') issue.labels.push('dev')
    let status: number
    try {
      const response = await fetch(`https://api.github.com/repos/${env.FEEDBACK_REPO}/issues`, {
        method: 'POST',
        headers: githubHeaders(env),
        body: JSON.stringify(issue),
      })
      status = response.status
    } catch (error) {
      console.error('feedback: github unreachable', error)
      throw new ApiError('feedback-failed')
    }
    if (status !== 201) {
      // `feedback: github 401` is an expired token: the runbook's weekly check says to renew it.
      console.error(`feedback: github ${status}`)
      throw new ApiError('feedback-failed')
    }
    return json({ sent: true }, 201)
  },
}
