import type { PluralForms } from '../plural'

/** The Reference image. */
export interface ReferenceTranslations {
  /** The reference image (ReferenceImage card, ticket 0790): the strip button, the Project panel's section, Adjust. */
  referenceImage: {
    /** The strip button's name. */
    name: string
    /** The strip button's Tooltip body with no picture yet, and while it is shown or hidden. */
    addTooltip: string
    showTooltip: string
    hideTooltip: string
    /** The Project panel section's label. */
    section: string
    /** The folded section's summary: "50% · shown", with {opacity} and {state}. */
    summary: string
    shown: string
    hidden: string
    /** The Info Tooltip, with {maxSizeMb}. */
    info: string
    add: string
    /** The stored picture's facts: "2048 × 1536 · 412 KB", with {width}, {height} and {size}. */
    facts: string
    /** A stored size in kilobytes, with {count}. */
    kilobytes: string
    opacity: string
    /** One opacity choice, "50%", with {count}. */
    percent: string
    replace: string
    remove: string
    removeTitle: string
    removeMessage: string
    removeButton: string
    cancelButton: string
    /** A refused file, with {reason}, one of `reasons`. */
    refused: string
    /** Why a file is refused, one per ImageRejection, each to follow `refused`'s colon. */
    reasons: {
      heic: string
      svg: string
      unsupportedFormat: string
      tooLarge: string
      tooManyPixels: string
      decodeFailed: string
    }
    preparing: string
    /** The picture's name on the Canvas for a screen reader, with {opacity} and {angle}. */
    groupName: string
    corners: {
      'top-left': string
      'top-right': string
      'bottom-right': string
      'bottom-left': string
    }
    turn: string
    /** Announced after a turn, with {angle}. */
    turned: string
    moved: string
    resized: string
    /** The Project panel's save icon while the picture is not kept on this device. */
    notSaved: string
    /** The picture bar (ticket 0883): the Move grip's name and Tooltip, ··· and its pressed face, the opened part's short
     * Replace and Remove, and the size chip while a corner is dragged ({size} a Grid size, {measure} its measure). */
    bar: {
      move: string
      moveBody: string
      more: string
      close: string
      /** Picture over the beads (ticket 1009): its name and Tooltip body. */
      over: { name: string; body: string }
      replace: string
      remove: string
      sizeBeads: string
      sizeMeasure: string
    }
    /** Set Frame around the picture (ticket 0883): its name, Tooltip with and without a Frame, and the preview's tag. */
    frameAround: {
      name: string
      body: string
      bodyNew: string
      tag: string
    }
    /** Convert to beads (ticket 0883): the button, the popover, the preview's pill, the toast and why it is off. */
    convert: {
      name: string
      body: string
      size: string
      sizeInfoName: string
      sizeInfo: string
      /** The size's measure, with {measure}. */
      measure: string
      /** The colors' count, with {count} and {max}. */
      colorsCount: string
      colorsLess: string
      colorsMore: string
      hideAfter: string
      allSettings: string
      button: PluralForms
      replaces: PluralForms
      preview: string
      /** The toast, with {n} and {colors}, its form chosen by {colors}. */
      made: PluralForms
      hidden: string
      tooSmall: string
      tooBig: string
    }
  }
}
