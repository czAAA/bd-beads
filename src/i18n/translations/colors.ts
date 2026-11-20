import type { PluralForms } from '../plural'

/** The Palette, its color names and Replace bead. */
export interface ColorsTranslations {
  /** The Palette's color names (`writing.md`, Color names). */
  colorNames: Record<string, string>
  palette: {
    pickerLabel: string
    colorLabel: string
    undoButton: string
    redoButton: string
    rotateButton: string
    /** CONTEXT.md's Custom color glossary entry: the button at the end of the Colors group that opens the color
     * picker. */
    customColorLabel: string
    /** A catalog color's name from its Color catalog entry (ticket 0760): `{finish}` and `{family}` in the language's order. */
    catalogColorName: string
    /** The picker's wheel (ticket 449): its name, and its value as heard, `{hue}` in degrees and `{saturation}` in
     * percent. */
    wheelLabel: string
    wheelValue: string
    brightnessLabel: string
    hexLabel: string
    /** The short note under the hex field while what is typed is not a color. */
    hexInvalid: string
    /** The preview swatch's name: the color the picker would take. */
    previewLabel: string
    /** The + on the Custom color picker's preview (ticket 0690): adds the color and keeps the picker open. */
    addToPalette: string
    pickFromCanvasLabel: string
    /** The toast after an added swatch is removed (ticket 228); its Undo is `undoButton`. */
    removed: string
    /** A removal button's accessible name; `{hex}` is the swatch's color. */
    removeSwatch: string
    /** The colour popover's pencil (ticket 531): enters Edit palette, and ends it (its name while on). */
    editPalette: string
    doneEditingPalette: string
    /** The Tooltip of a built-in swatch in Edit palette. */
    defaultColorLocked: string
    /** The Palette's Letters switch's Tooltip (ticket 1092). */
    lettersLine: string
    /** A swatch's name while it shows its letter. */
    swatchLetter: string
    /** The letter button under a swatch in Edit palette, its field, and what a letter taken from another color did. */
    changeLetter: string
    letterField: string
    letterSwapped: string
    /** The confirmation before an added swatch is removed (ticket 304); `{hex}` in the message is the swatch's
     * color. */
    removeConfirmTitle: string
    removeConfirmMessage: string
    /** After removeConfirmMessage when beads are painted in the color: they leave with it (ticket 1124). */
    removeConfirmBeads: PluralForms
    /** After removeAllConfirmMessage when beads are painted in the colors: they leave with them (ticket 1124). */
    removeAllConfirmBeads: PluralForms
    removeConfirmButton: string
    removeCancelButton: string
    /** Remove all custom colors (ticket 0532): the bin's name and Tooltip, the toast, and the confirmation; `{count}` in
     * the message is how many colors leave. */
    removeAllColors: string
    removedAll: string
    removeAllConfirmTitle: string
    removeAllConfirmMessage: PluralForms
    removeAllConfirmButton: string
    /** The Bead's Color catalog, to add a maker's color to the Palette (ticket 0537): `{code}` is the maker's code,
     * `{count}` a count of rows or of a filter value `{name}`. Its filters and empty state (ticket 0713): `{query}` the
     * search text, `{filters}` the on values' names (Finishes, then families), `{sizes}` a code's sizes, `{size}` the Bead's. */
    beadColors: {
      /** The entry button, `{bead}` the Bead's label (ticket 0746). */
      open: string
      /** The Info button after it, which holds the approximate and taken notes. */
      info: string
      /** The count line: `{count}` codes matched, and how many are shown past the cap. */
      codeCount: string
      firstShown: string
      legendApproximate: string
      approximateName: string
      approximateBody: string
      measuredName: string
      measuredBody: string
      approximateSuffix: string
      measuredSub: string
      /** The narrow layout's disclosure, and its name while `{count}` values are on. */
      filters: string
      filtersOn: string
      label: string
      search: string
      approximate: string
      /** The same note for a catalog with measured colors (ticket 0886): they were read from the maker's photographs. */
      photoColors: string
      /** The same note for TOHO's catalog (ticket 1068): its colors were read from TOHO's sample cards. */
      cardColors: string
      inPalette: string
      takenNote: string
      discontinued: string
      /** A row's name (ticket 0940): the words it shows first, `{name}` being rowName, with rowNote's Discontinued. */
      rowName: string
      rowNote: string
      add: string
      takenLabel: string
      /** A row the Palette holds (ticket 1092): what it says at its end, its names, and the Info note on taking it out. */
      sameColor: string
      defaultColor: string
      defaultLabel: string
      remove: string
      heldLabel: string
      removeNote: string
      noMatch: string
      noMatchFiltered: string
      noneFiltered: string
      otherSizes: string
      colorFilter: string
      finishFilter: string
      clearFilters: string
      /** The foot row that opens a bead-color Report (ticket 0700). */
      reportColor: string
      valueCount: string
      loading: string
      failed: string
      /** The Finish list shared by every Brand (ADR 0072). */
      finishes: Record<'transparent' | 'opaque' | 'ceylon' | 'silver-lined' | 'luster' | 'matte' | 'rainbow' | 'metallic' | 'plated', string>
    }
  }
  /** The Replace Bead control (CONTEXT.md, ADR 0007) in each layer's panel (ticket 0687), and its confirmation modal
   * (ticket 48). */
  replaceBead: {
    selectLabel: string
    confirmTitle: string
    // The Canvas's Bead (ticket 0687): `{old}`/`{new}` its Bead's size in mm before and after. Says it looks different in
    // proportion, the design and bead count stay, and it can be undone.
    canvasMessage: string
    // The Frame's Bead (ticket 0687): `{old}`/`{new}` as for the Canvas, then `{newSize}`/`{oldSize}` the Frame's
    // Estimated size in mm with the new Bead and the old.
    frameMessage: string
    confirmButton: string
    /** After the Project's own Bead when the catalog's Bead of the same id has changed (ticket 534). */
    outdatedPostfix: string
    cancelButton: string
  }
}
