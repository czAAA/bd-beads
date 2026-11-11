import { describe, expect, it } from 'vitest'
import { imageLimitsText } from './imageLimits'

describe('imageLimitsText (ticket 0863)', () => {
  it('joins the formats as the language says "or", with the other blanks filled', () => {
    expect(imageLimitsText('en', 'Use {formats}, up to {maxSizeMb} MB. Paste with {pasteKey}.', { pasteKey: '⌘V' })).toBe(
      'Use PNG, JPEG, GIF, or WebP, up to 10 MB. Paste with ⌘V.',
    )
    expect(imageLimitsText('ru', '{formats}')).toBe('PNG, JPEG, GIF или WebP')
    expect(imageLimitsText('pl', '{formats}')).toBe('PNG, JPEG, GIF lub WebP')
  })
})
