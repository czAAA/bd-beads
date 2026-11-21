// The features that work but are still being tested (ticket 1198): each place that names one asks `isBeta` and shows
// the Beta chip. Removing a feature from the list removes all its chips in one commit; an empty list, the chip entirely.

export type BetaFeature = 'convertImage' | 'convertToBeads' | 'customFrames' | 'customFrameExports'

/** The features in beta right now. */
const BETA_FEATURES: readonly BetaFeature[] = ['convertImage', 'convertToBeads', 'customFrames', 'customFrameExports']

/** Whether a feature still carries the Beta chip. */
export function isBeta(feature: BetaFeature, features: readonly BetaFeature[] = BETA_FEATURES): boolean {
  return features.includes(feature)
}

/** What Send feedback starts the message with: the feature's name and "(beta)". */
export function betaSubject(name: string): string {
  return `${name} (beta)`
}

/** A Custom frame Starter's subject: "Custom frame: Kite". */
export function customFrameName(starter: string): string {
  return `Custom frame: ${starter}`
}
