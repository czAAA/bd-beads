export type Locale = 'en' | 'ru'

export interface Translations {
  app: {
    title: string
  }
  form: {
    nameLabel: string
    beadLabel: string
    techniqueLabel: string
    techniqueLoom: string
    techniquePeyote: string
    techniqueBrick: string
    widthLabel: string
    heightLabel: string
    unitLabel: string
    unitMm: string
    unitCm: string
    submit: string
  }
  languageSwitcher: {
    ariaLabel: string
  }
  patterns: {
    heading: string
    newPatternButton: string
    removeButton: string
    currentLabel: string
    unknownBeadLabel: string
    noSavedPatternsMessage: string
  }
  canvas: {
    zoomInLabel: string
    zoomOutLabel: string
    zoomResetLabel: string
  }
  shell: {
    canvasPlaceholder: string
  }
  /** Storage's own voice in the UI: what it says when a write to this device didn't get through (ticket 55). */
  storage: {
    saveFailedMessage: string
  }
  palette: {
    pickerLabel: string
    colorLabel: string
    undoButton: string
    redoButton: string
    rotateButton: string
    /** CONTEXT.md's Custom color glossary entry: the native-picker slot at the end of the Colors group. */
    customColorLabel: string
  }
  tools: {
    paintLabel: string
    fillLabel: string
    selectLabel: string
    /** The 4th Tool group member (ticket 89): flood-erases a clicked region's connected same-color cells. */
    eraseLabel: string
    copyButton: string
    /** Ctrl/Cmd+V (ticket 92) has no Toolbox button of its own — only the shortcuts help overlay (ticket 96) names it. */
    pasteLabel: string
  }
  rowProgress: {
    enabledLabel: string
    directionButton: string
    positionLabel: string
    previousButton: string
    nextButton: string
  }
  quantities: {
    heading: string
    noPatternMessage: string
    noColorsMessage: string
    colorHeading: string
    countHeading: string
  }
  /** Export/import (CONTEXT.md's Pattern file), plus QR export/import (ticket 68, ADR 0015). */
  transfer: {
    heading: string
    exportPatternButton: string
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    importErrorLabel: string
    /** Encodes the open Pattern as a single scannable QR code (compact encoding, ADR 0009), shown inline below. */
    exportQrButton: string
    /** Shown instead of the code when the Pattern doesn't fit a single QR code's capacity (ADR 0015's size cap) -- points at Export Pattern above as the fallback rather than duplicating a download of its own. */
    qrTooLargeMessage: string
    closeQrButton: string
    /** A picture believed to hold one of this app's QR exports (a photo/screenshot of the code shown on another device). */
    importQrLabel: string
    qrImportedLabel: string
    qrImportErrorLabel: string
  }
  mirror: {
    mirrorCurrentHorizontalButton: string
    mirrorCurrentVerticalButton: string
    /** The two per-direction axis counters (ticket 44), named for what they do on screen -- rotating the Pattern
     * swaps which grid axis each shows. */
    leftRightLabel: string
    topBottomLabel: string
    decreaseLeftRightButton: string
    increaseLeftRightButton: string
    decreaseTopBottomButton: string
    increaseTopBottomButton: string
    /** Mirror's copy-mode switch (ticket 45): one switch for both directions. */
    copyModeLabel: string
  }
  /** Titles of the Toolbox's five Tool groups (CONTEXT.md), shown in each group's top-left corner (ticket 40). */
  toolbox: {
    groups: {
      tools: string
      colors: string
      edit: string
      mirror: string
      rowProgress: string
    }
  }
  /** The Delete all control (CONTEXT.md) and its confirmation modal (ticket 42). */
  deleteAll: {
    button: string
    confirmTitle: string
    confirmMessage: string
    confirmButton: string
    cancelButton: string
  }
  /**
   * Convert image (CONTEXT.md, ADR 0010/0011): the file input in the New Pattern form, the framing step that takes the
   * canvas panel over, and Image colors in the Colors group.
   *
   * Every string here holding `{formats}`, `{maxSizeMb}` or `{maxMegapixels}` is filled in by formatImageLimits (see
   * domain/imageConversion.ts) from the very constants the validation enforces, so the limits the UI advertises and the
   * limits it applies cannot drift apart. Never write the numbers out here.
   */
  convertImage: {
    /** The file input's own label in the New Pattern form. */
    fileLabel: string
    /** The limits, shown as helper text under the file input and repeated as its `title`. */
    limitsHint: string
    /**
     * The heads-up shown once the current Bead + Technique + size implies a grid past that Technique's
     * isSlowFramingSize threshold (ticket 61) — informational, not an error, and never blocks the file input.
     * `{technique}` is filled in with the chosen Technique's own localized name (form.techniqueLoom etc).
     */
    slowFramingWarning: string
    /** The framing step's heading in the canvas panel. */
    heading: string
    /** How to move the picture under the frame. */
    panHint: string
    createButton: string
    cancelButton: string
    /** The adjustable ceiling on how many colors the conversion may keep. */
    maxColorsLabel: string
    decreaseColorsButton: string
    increaseColorsButton: string
    /** Prefix for how many colors this conversion actually found, e.g. "Colors found: 6". */
    foundColorsLabel: string
    /** Names the Image colors swatches in the Colors group (CONTEXT.md's Image colors). */
    imageColorsLabel: string
    /** One per reason a picture can be turned away (see domain/imageConversion.ts's ImageRejection). */
    errors: {
      heic: string
      svg: string
      unsupportedFormat: string
      tooLarge: string
      tooManyPixels: string
      decodeFailed: string
    }
  }
  /** The Replace Bead control (CONTEXT.md, ADR 0008) next to the open Pattern's Bead, and its confirmation modal (ticket 48). */
  replaceBead: {
    selectLabel: string
    /** Prefix for the new grid size shown in the confirmation message, e.g. "New size: 45×62." */
    newSizeLabel: string
    confirmTitle: string
    confirmMessage: string
    confirmButton: string
    cancelButton: string
  }
  /** The `?` shortcuts help overlay (ticket 96): every keyboard shortcut, grouped by Tool group. Key labels
   * themselves (digits, letters, "Ctrl/Cmd+C") are locale-neutral and built inline in ShortcutsHelp.vue rather than
   * translated here — only the description of what each one does needs a translation. */
  shortcutsHelp: {
    title: string
    closeButton: string
    /** Ticket 90: Del either activates Erase or clears the active Selection, depending on context. */
    eraseOrClearSelection: string
    /** Ticket 95: Space+drag. */
    panCanvas: string
    /** Ticket 88's whole Colors group, summarized as one row rather than one per swatch. */
    paletteColors: string
  }
}
