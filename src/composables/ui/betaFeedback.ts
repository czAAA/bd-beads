import { inject, provide, type InjectionKey } from 'vue'

/** Opens the Feedback sheet (`general` kind) started with a subject; what a Beta chip's Send feedback calls. */
export type SendBetaFeedback = (subject: string) => void

const betaFeedbackKey: InjectionKey<SendBetaFeedback> = Symbol('betaFeedback')

/** The app shell and the Homepage hand their Feedback sheet to every Beta chip below them (ticket 1198). */
export function provideBetaFeedback(send: SendBetaFeedback) {
  provide(betaFeedbackKey, send)
}

/** Absent (mounted alone, the demo) means the chip's popover offers no Send feedback. */
export function useBetaFeedback(): SendBetaFeedback | undefined {
  return inject(betaFeedbackKey, undefined)
}
