import { describe, expect, it } from 'vitest'
import { betaSubject, customFrameName, isBeta } from './betaFeatures'

describe('the Beta registry (ticket 1198)', () => {
  it('lists the four features in beta', () => {
    for (const feature of ['convertImage', 'convertToBeads', 'customFrameExports', 'customFrames'] as const) expect(isBeta(feature)).toBe(true)
  })

  it('answers by the registry it is given: a feature taken out has no chip', () => {
    expect(isBeta('convertImage')).toBe(true)
    expect(isBeta('convertImage', ['customFrames'])).toBe(false)
    expect(isBeta('customFrames', [])).toBe(false)
  })

  it('names what Send feedback starts the message with', () => {
    expect(betaSubject('Convert image')).toBe('Convert image (beta)')
    expect(betaSubject(customFrameName('Kite'))).toBe('Custom frame: Kite (beta)')
  })
})
