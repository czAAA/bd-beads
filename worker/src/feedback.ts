import { parseReport, reportIssue } from '../../src/domain/feedbackReport'
import type { Route } from './api'
import { readJson } from './body'
import { ApiError, json } from './errors'
import { FEATURE_OFF_RETRY_SECONDS } from './features'
import { takeReport } from './feedbackDay'
import { rateLimit, sizeCap, turnstile } from './guards'

/** Not a tuning knob: a valid Report is at most about 7,000 characters (domain/feedbackReport.ts's limits), so this only
 * keeps a flood's body out of memory. */
const FEEDBACK_BODY_CAP_BYTES = 64 * 1024

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
    const issue = reportIssue(report)
    if (env.WORKER_NAME === 'dev') issue.labels.push('dev')
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
    let status: number
    try {
      const response = await fetch(`https://api.github.com/repos/${env.FEEDBACK_REPO}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          // GitHub refuses a request without one.
          'User-Agent': `bd-beads-${env.WORKER_NAME}`,
        },
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
