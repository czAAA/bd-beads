import { parseReport, reportIssue } from '../../src/domain/feedbackReport'
import type { RequestContext, Route } from './api'
import { readBody, upload } from './body'
import { ApiError, json } from './errors'
import { rateLimit, sizeCap, turnstile } from './guards'

/** Not a tuning knob: a valid Report is at most about 7,000 characters (domain/feedbackReport.ts's limits), so this only
 * keeps a flood's body out of memory. */
const FEEDBACK_BODY_CAP_BYTES = 64 * 1024

/** The body as JSON, or `400 bad-request` when it isn't. */
async function readJson(rc: RequestContext): Promise<unknown> {
  const bytes = await readBody(upload(rc))
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new ApiError('bad-request')
  }
}

/** `POST /api/feedback` (ADR 0081, spec 0698): a Report becomes one issue in `FEEDBACK_REPO`, built here from its
 * fields, never from a client's title or labels; the dev Worker's are labelled `dev`. GitHub's `401` (an expired
 * token) is logged by name for the dashboard; every GitHub failure is `502 feedback-failed`, with no retry. */
export const feedbackRoute: Route = {
  method: 'POST',
  path: '/api/feedback',
  feature: 'feedback',
  guards: [
    turnstile(),
    rateLimit({ binding: 'FEEDBACK_RATE', periodSeconds: 60 }),
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
