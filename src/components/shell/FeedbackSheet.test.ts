import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FeedbackSheet from './FeedbackSheet.vue'
import type { FeedbackRequest } from '../../composables/shell/useFeedbackFlow'
import type { Report, ReportKind, ReportSent } from '../../domain/feedbackReport'

const context = { appVersion: '1.4.0', uiLanguage: 'pl', browser: 'Firefox', os: 'Android', viewport: '412 × 915' }
const COLOR = { brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB-2100', hex: '#3a6b8c', swatchLetter: 'C' }

function request(kind: ReportKind, change: Partial<FeedbackRequest> = {}): FeedbackRequest {
  const prefill = kind === 'bead-color' ? COLOR : {}
  return { kind, prefill, context: kind === 'bead-color' ? { ...context, ...COLOR } : context, email: '', ...change }
}

function sheet(asked: FeedbackRequest, outcome: ReportSent = { sent: true }) {
  const send = vi.fn(async (_report: Report) => outcome)
  const copy = vi.fn(async (_text: string) => true)
  const stop = vi.fn()
  const verify = vi.fn(() => stop)
  const wrapper = mount(FeedbackSheet, { props: { request: asked, send, copy, verify }, attachTo: document.body })
  return { wrapper, send, copy, verify, stop }
}

const submit = async (wrapper: ReturnType<typeof sheet>['wrapper']) => {
  await wrapper.get('form#feedback-sheet-form').trigger('submit')
  await flushPromises()
}
/** The fields a kind asks for, in order; the sheet is closed after, as two open modals would fight over focus. */
function fieldIds(kind: ReportKind) {
  const { wrapper } = sheet(request(kind))
  const ids = wrapper.findAll('[data-testid^="feedback-"]').map((each) => each.attributes('data-testid')).filter((id) => /message|language|shown|should-say|note|problem|brand|code|looks-like|email/.test(id!))
  wrapper.unmount()
  return ids
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FeedbackSheet', () => {
  it('asks each Report kind for its own fields, an Email last', () => {
    expect(fieldIds('general')).toEqual(['feedback-message', 'feedback-email'])
    expect(fieldIds('translation')).toEqual(['feedback-language', 'feedback-shown', 'feedback-should-say', 'feedback-note', 'feedback-email'])
    expect(fieldIds('bead-color')).toEqual([
      'feedback-problem',
      'feedback-brand',
      'feedback-code',
      'feedback-looks-like',
      'feedback-note',
      'feedback-email',
    ])
  })

  it('starts a translation Report in the app’s language, which can be changed', async () => {
    const { wrapper, send } = sheet(request('translation'))
    const chosen = () => wrapper.get('[data-testid="feedback-language"] [aria-checked="true"]').text()
    expect(chosen()).toBe('Polski')
    await wrapper.findAll('[data-testid="feedback-language"] [role="radio"]').find((chip) => chip.text() === 'Español')!.trigger('click')
    await wrapper.get('[data-testid="feedback-shown"]').setValue('Guardar cuenta')
    await submit(wrapper)
    const sent = send.mock.calls[0]![0]
    expect(sent).toMatchObject({ kind: 'translation', fields: { language: 'es', shown: 'Guardar cuenta' }, context: { language: 'es' } })
  })

  it('starts a color Report from the swatch it was opened at: Brand and catalog read-only, the code editable', async () => {
    const { wrapper, send } = sheet(request('bead-color'))
    expect(wrapper.get('[data-testid="feedback-brand"]').text()).toBe('Miyuki, miyuki-delica')
    expect(wrapper.find('[data-testid="feedback-brand"] input').exists()).toBe(false)
    expect((wrapper.get('[data-testid="feedback-code"]').element as HTMLInputElement).value).toBe('DB-2100')
    expect(wrapper.get('[data-testid="feedback-problem"] [aria-checked="true"]').text()).toBe('Wrong color')
    await wrapper.get('[data-testid="feedback-looks-like"]').setValue('#1d5c63')
    await submit(wrapper)
    expect(send.mock.calls[0]![0]).toMatchObject({
      kind: 'bead-color',
      fields: { problem: 'wrong', brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB-2100', looksLike: '#1d5c63' },
    })
  })

  it('prefills the email it is given, which can be cleared, and sends it only when there is one', async () => {
    const { wrapper, send } = sheet(request('general', { email: 'maker@example.com' }))
    const email = wrapper.get('[data-testid="feedback-email"]')
    expect((email.element as HTMLInputElement).value).toBe('maker@example.com')
    await wrapper.get('[data-testid="feedback-message"]').setValue('Hello')
    await submit(wrapper)
    expect(send.mock.calls[0]![0].email).toBe('maker@example.com')
    await email.setValue('')
    await submit(wrapper)
    expect(send.mock.calls[1]![0]).not.toHaveProperty('email')
  })

  it('sends nothing while a required field is empty or the email is not one, and says which', async () => {
    const general = sheet(request('general'))
    await submit(general.wrapper)
    expect(general.send).not.toHaveBeenCalled()
    expect(general.wrapper.text()).toContain('Write a message.')
    general.wrapper.unmount()

    const translation = sheet(request('translation'))
    await submit(translation.wrapper)
    expect(translation.send).not.toHaveBeenCalled()
    expect(translation.wrapper.text()).toContain('Enter the text as it shows.')
    translation.wrapper.unmount()

    const typo = sheet(request('general'))
    await typo.wrapper.get('[data-testid="feedback-message"]').setValue('Hello')
    await typo.wrapper.get('[data-testid="feedback-email"]').setValue('maker@')
    await submit(typo.wrapper)
    expect(typo.send).not.toHaveBeenCalled()
    expect(typo.wrapper.text()).toContain('Enter an email such as name@example.com.')
  })

  it('shows what is also sent, folded until asked, exactly as sent and never the Project', async () => {
    const { wrapper, send } = sheet(request('bead-color'))
    expect(wrapper.find('[data-testid="feedback-also-sent"]').exists()).toBe(false)
    const toggle = wrapper.get('[data-testid="feedback-also-sent-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    const rows = wrapper.findAll('[data-testid="feedback-also-sent"] [data-key]').map((row) => [row.attributes('data-key'), row.find('dd').text()])
    expect(rows).toEqual([
      ['appVersion', '1.4.0'],
      ['uiLanguage', 'pl'],
      ['browser', 'Firefox'],
      ['os', 'Android'],
      ['viewport', '412 × 915'],
      ['brand', 'Miyuki'],
      ['catalog', 'miyuki-delica'],
      ['code', 'DB-2100'],
      ['hex', '#3a6b8c'],
      ['swatchLetter', 'C'],
    ])
    await submit(wrapper)
    expect(Object.fromEntries(rows)).toEqual(send.mock.calls[0]![0].context)
  })

  it('starts Turnstile as it opens and stops it as it closes', () => {
    const { wrapper, verify, stop } = sheet(request('general'))
    expect(verify).toHaveBeenCalledWith(expect.any(HTMLElement))
    wrapper.unmount()
    expect(stop).toHaveBeenCalledOnce()
  })

  it.each<[ReportSent, string]>([
    [{ sent: false, reason: 'off', retryAfterSeconds: 900 }, 'Sending reports is switched off for now. Try again in 15 min.'],
    [{ sent: false, reason: 'offline' }, 'You are offline.'],
    [{ sent: false, reason: 'rate-limited', retryAfterSeconds: 60 }, 'Too many reports at once. Try again in 60 s.'],
    [{ sent: false, reason: 'failed' }, 'The report could not be sent.'],
  ])('keeps what was typed when %o, says why and offers Copy report', async (outcome, says) => {
    const { wrapper, copy } = sheet(request('general'), outcome)
    await wrapper.get('[data-testid="feedback-message"]').setValue('The Row progress bar jumps back.')
    await submit(wrapper)
    expect(wrapper.get('[data-testid="feedback-failed"]').text()).toContain(says)
    expect((wrapper.get('[data-testid="feedback-message"]').element as HTMLTextAreaElement).value).toBe('The Row progress bar jumps back.')
    await wrapper.get('[data-testid="feedback-copy"]').trigger('click')
    await flushPromises()
    const copied = copy.mock.calls[0]![0]
    expect(copied.startsWith('# feedback: The Row progress bar jumps back.\n\n### Message\n\nThe Row progress bar jumps back.')).toBe(true)
    expect(copied).toContain('| App version | 1.4.0 |')
    expect(wrapper.get('[data-testid="feedback-copied"]').text()).toBe('Report copied.')
  })

  it('cancels from its Cancel button', async () => {
    const { wrapper } = sheet(request('general'))
    await wrapper.get('[data-testid="feedback-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
