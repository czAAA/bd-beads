import { describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import { fakeFeedback } from '../../testUtils/fakeFeedback'
import type { Report, ReportSent } from '../../domain/feedbackReport'
import { useDialogs } from './useDialogs'
import { useFeedbackFlow } from './useFeedbackFlow'

function flow(outcome: ReportSent = { sent: true }, accountEmail?: string) {
  const dialogs = useDialogs()
  const feedback = fakeFeedback(outcome)
  const showToast = vi.fn()
  const wired = useFeedbackFlow({ feedback, locale: () => 'uk', messages: () => en, showToast, dialogs, accountEmail: () => accountEmail })
  return { ...wired, dialogs, feedback, showToast }
}

const report: Report = { kind: 'general', fields: { message: 'Hello' }, context: { appVersion: '1', uiLanguage: 'en', browser: 'Chrome', os: 'Linux', viewport: '1 × 1' } }

describe('useFeedbackFlow', () => {
  it('opens the sheet with its kind and the context read as it opens: version, language, browser and system, window', () => {
    const { onOpenFeedback, feedbackRequest, dialogs } = flow()
    onOpenFeedback('general')
    expect(dialogs.open.value).toBe('feedback')
    const { context } = feedbackRequest.value!
    expect(context).toEqual({
      appVersion: __APP_VERSION__,
      uiLanguage: 'uk',
      browser: expect.any(String),
      os: expect.any(String),
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
    })
    expect(context.browser).not.toMatch(/\d/)
  })

  it('adds a color Report’s prefill to its context, and nothing of it to another kind', () => {
    const { onOpenFeedback, feedbackRequest } = flow()
    const prefill = { brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB-2100', hex: '#3a6b8c', swatchLetter: 'C' }
    onOpenFeedback('bead-color', prefill)
    expect(feedbackRequest.value).toMatchObject({ kind: 'bead-color', prefill, context: prefill })
    onOpenFeedback('translation', prefill)
    expect(feedbackRequest.value!.context).not.toHaveProperty('code')
  })

  it('starts from the account’s email when signed in, else from none', () => {
    const signedIn = flow({ sent: true }, 'maker@example.com')
    signedIn.onOpenFeedback('general')
    expect(signedIn.feedbackRequest.value!.email).toBe('maker@example.com')
    const visitor = flow()
    visitor.onOpenFeedback('general')
    expect(visitor.feedbackRequest.value!.email).toBe('')
  })

  it('sends with the open sheet’s Turnstile, then closes and thanks with a toast', async () => {
    const { onOpenFeedback, verifyFeedback, sendReport, feedback, showToast, dialogs } = flow()
    onOpenFeedback('general')
    verifyFeedback(document.createElement('div'))
    expect(await sendReport(report)).toEqual({ sent: true })
    expect(feedback.send).toHaveBeenCalledWith(report, expect.objectContaining({ token: expect.any(Function) }))
    expect(dialogs.open.value).toBeUndefined()
    expect(showToast).toHaveBeenCalledWith('feedback-sent', 'Thanks, your report was sent')
  })

  it('keeps the sheet open and shows no toast when sending fails', async () => {
    const { onOpenFeedback, verifyFeedback, sendReport, showToast, dialogs } = flow({ sent: false, reason: 'failed' })
    onOpenFeedback('general')
    verifyFeedback(document.createElement('div'))
    expect(await sendReport(report)).toEqual({ sent: false, reason: 'failed' })
    expect(dialogs.open.value).toBe('feedback')
    expect(showToast).not.toHaveBeenCalled()
  })

  it('removes Turnstile when the sheet stops it, and then cannot send', async () => {
    const { onOpenFeedback, verifyFeedback, sendReport, feedback } = flow()
    onOpenFeedback('general')
    verifyFeedback(document.createElement('div'))()
    expect(feedback.dispose).toHaveBeenCalledOnce()
    expect(await sendReport(report)).toEqual({ sent: false, reason: 'failed' })
    expect(feedback.send).not.toHaveBeenCalled()
  })
})
