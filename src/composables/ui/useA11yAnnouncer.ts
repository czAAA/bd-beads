import { nextTick, ref } from 'vue'
import type { GridPosition } from '../../domain/grid'
import { PALETTE } from '../../domain/palette'
import { beadColorAt, type Pattern } from '../../domain/pattern'
import type { Translations } from '../../i18n/translations'

/** What announcing needs from the app shell: the language, the open Pattern and the bead cursor. */
export interface A11yAnnouncerDeps {
  messages: () => Translations
  currentPattern: () => Pattern | undefined
  beadCursor: () => GridPosition
}

/**
 * Screen-reader announcements (tickets 159, 192; ADR 0023): the one polite live-region message per action -- the bead
 * cursor's place and color, what a key just did. Deps are read lazily.
 */
export function useA11yAnnouncer(deps: A11yAnnouncerDeps) {
  /** The live region's text. */
  const announcement = ref('')

  function announce(text: string) {
    // Cleared first, so the same words said twice are still heard twice.
    announcement.value = ''
    void nextTick(() => {
      announcement.value = text
    })
  }

  /** A bead color in words: the Palette's name for it, "Custom" for any other color, "empty" for none. */
  function colorWords(hex: string | null | undefined): string {
    const t = deps.messages()
    if (!hex) return t.a11y.emptyBead
    const color = PALETTE.find((entry) => entry.hex.toLowerCase() === hex.toLowerCase())
    return color ? (t.colorNames[color.id] ?? hex) : t.colorNames.custom!
  }

  /**
   * Says the bead cursor's row, column and the color under it. With a Frame the numbers are the Frame's own (its rulers
   * count from 1 at its top-left), so a bead above or left of it is row or column 0 and below; with none they are the
   * canvas's, from the bead at row 0, column 0.
   */
  function announceCursor() {
    const pattern = deps.currentPattern()
    if (!pattern) return
    const { row, column } = deps.beadCursor()
    announce(
      deps
        .messages()
        .a11y.cursorPosition.replace('{row}', String(row - (pattern.frame?.row ?? 0) + 1))
        .replace('{column}', String(column - (pattern.frame?.column ?? 0) + 1))
        .replace('{color}', colorWords(beadColorAt(pattern, row, column))),
    )
  }

  return { announcement, announce, announceCursor, colorWords }
}
