/** Signing in, the privacy policy and the Feedback sheet. */
export interface AccountTranslations {
  /** The Feedback sheet (ADR 0081, spec 0698, ticket 0700): its three Report kinds' titles and fields, the Also sent
   * block's rows, and why a Report was not sent. */
  feedback: {
    titleGeneral: string
    titleTranslation: string
    titleBeadColor: string
    introGeneral: string
    introTranslation: string
    introBeadColor: string
    message: string
    language: string
    shown: string
    shouldSay: string
    note: string
    problem: string
    wrongColor: string
    missingColor: string
    brandCatalog: string
    code: string
    looksLike: string
    looksLikeHint: string
    email: string
    emailHint: string
    /** The Email hint when the field starts as the signed-in account's email (ticket 0078). */
    emailHintAccount: string
    messageRequired: string
    shownRequired: string
    emailInvalid: string
    alsoSent: string
    alsoSentNote: string
    ctxAppVersion: string
    ctxUiLanguage: string
    ctxBrowser: string
    ctxOs: string
    ctxViewport: string
    ctxLanguage: string
    ctxBrand: string
    ctxCatalog: string
    ctxCode: string
    ctxHex: string
    ctxSwatchLetter: string
    send: string
    sending: string
    cancel: string
    copyReport: string
    copied: string
    copyFailed: string
    off: string
    offline: string
    rateLimited: string
    failed: string
    sent: string
  }
  /** Signing in (ticket 0078; MenuPanel and SignIn cards, `copy/account.md` Sign-in copy): the Menu's Account section, the
   * Sign in Subpanel and its toasts. The words are Sign in and Sign out; the plans Free account and Pro. */
  account: {
    section: string
    signIn: string
    signOut: string
    /** Under Sign in, for a Guest. */
    guestNote: string
    planFree: string
    planPro: string
    /** Signed in, under the email: the settings line (ticket 1086), its Info button's name and the note that lists
     * which settings are the same on every device. A setting added later changes the note, never the line. */
    settingsLine: string
    settingsInfoLabel: string
    settingsInfo: string
    /** The Subpanel's first line: what signing in is for, and that Projects stay. */
    purpose: string
    /** What is kept: the heading, one row per thing kept, and the line under the list. */
    keepsHeading: string
    keepsEmail: string
    keepsSettings: string
    keepsNothingElse: string
    /** The Google button, at rest and between the press and the page leaving; and the line under it. */
    continueWithGoogle: string
    openingGoogle: string
    firstTime: string
    /** Above Cloudflare's widget, in the rare case it asks the person something. */
    oneMoreCheck: string
    /** Back from Google not signed in: the person said no there, something failed, new accounts are paused. */
    cancelled: string
    failed: string
    paused: string
    /** The toast when signing in can't be done for now, with {time} from `waitSeconds` or `waitMinutes` ({count}). */
    unavailable: string
    waitSeconds: string
    waitMinutes: string
    /** The toast with no internet. */
    offline: string
    /** The Menu's About row, and the Sign in Subpanel's link, to the privacy policy (ticket 0082). */
    privacy: string
    /** The Account section's row that asks "Delete your account?" (ticket 0082). */
    deleteAccount: string
    deleteTitle: string
    deleteMessage: string
    deleteConfirm: string
    /** The toast once the account is gone. */
    deleted: string
    /** The toast when the session had already ended, so nothing was deleted. */
    deleteSignedOut: string
    /** The toast when the backend can't delete now; `{time}` is its wait. */
    deleteUnavailable: string
    /** The toast with no internet. */
    deleteOffline: string
  }
  /** The privacy policy's page (ticket 0082), which is in English only. */
  privacy: {
    /** The one line in the device's language above the English policy; not shown in English. */
    englishOnly: string
  }
}
