import { vi } from 'vitest'
import type { ReportSent } from '../domain/feedbackReport'
import type { FeedbackService } from '../services/feedback'

/** A Feedback service that sends nothing (ticket 0700): `send` answers `outcome`, `copy` succeeds, and Turnstile is a
 * token at once; each is a spy. */
export function fakeFeedback(outcome: ReportSent = { sent: true }) {
  const dispose = vi.fn()
  const service = {
    verify: vi.fn(() => ({ token: async () => 'token', dispose })),
    send: vi.fn(async () => outcome),
    copy: vi.fn(async () => true),
  } satisfies FeedbackService
  return { ...service, dispose }
}
