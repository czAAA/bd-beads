import type { PluralForms } from '../plural'

/** The app around the Canvas: its title, New Project's form and fields, the header, theme and language, storage, opening a Project and the screen-reader words. */
export interface ShellTranslations {
  app: {
    title: string
  }
  form: {
    nameLabel: string
    beadLabel: string
    /** The Bead picker (ticket 535): `hint` is what a Bead sets, the help behind New Project's Bead Info button (ticket 0951);
     * Brand, Form factor and Bead size are its steps. */
    beadPicker: {
      hint: string
      change: string
      close: string
      brand: string
      formFactor: string
      size: string
      choose: string
    }
    techniqueLabel: string
    widthLabel: string
    heightLabel: string
    /** Stepper buttons beside Width and Height (ticket 181), each named for screen readers like Stepper's own. */
    decreaseWidthButton: string
    increaseWidthButton: string
    decreaseHeightButton: string
    increaseHeightButton: string
    unitLabel: string
    /** The unit a Project's size can be stated in when it is a count of beads (ADR 0026) — the default. */
    unitBeads: string
    unitMm: string
    unitCm: string
    /** This Project's own maker's name (ticket 182), overriding the device-wide one; blank by default. */
    makerNameLabel: string
    submit: string
    /** Right of an optional field's label (TextField card). */
    optional: string
    /** Field errors say what to enter (`writing.md`, Field error). */
    enterWidth: string
    enterHeight: string
    enterWholeBeads: string
    /** Between Create Project and Convert image. */
    or: string
    /** What New Project's open canvas is for, under the panel's title (tickets 568, 0951). */
    openCanvasSubtitle: string
    /** The button that unfolds the Starter gallery. */
    pickStarter: string
    /** The Estimated size when the unit is mm: the same size as a count of beads, "≈ 40×30 beads" (ticket 342). */
    estimateBeads: string
    /** What a new Project left unnamed is called, and the Name's placeholder (ticket 0866): "Project 1", then the next
     * free number. It ends in its number, as Duplicate's suggestions do. */
    unnamedProject: string
    /** New Project's Info buttons (ticket 0951): what Technique decides, and each button's name; Bead's help is
     * `beadPicker.hint`. */
    techniqueInfo: string
    techniqueInfoLabel: string
    beadInfoLabel: string
  }
  /** Screen-reader words (ticket 159; `accessibility.md`, ScreenReaders card). */
  a11y: {
    toolsLandmark: string
    /** The Project's accessible name: "{name}, {columns} by {rows} beads, {colors}" plus, with Row progress on, the
     * progress. */
    projectLabel: string
    /** The Project's name for a screen reader while it has no Frame: a Canvas, with no size to state. */
    canvasLabel: string
    colorsCount: PluralForms
    progressDone: string
    /** A message's close ×. */
    closeMessage: string
    /** An expandable panel's expand button (BeadsNeeded, SavedProjects cards). */
    expandPanel: string
    collapsePanel: string
  }
  /** The header's theme control (ticket 139). */
  theme: {
    groupLabel: string
    matchDevice: string
    light: string
    dark: string
    contrast: string
  }
  languageSwitcher: {
    ariaLabel: string
  }
  shell: {
    /** Under 'No Project open yet': what to do (EmptyCanvas card). */
    canvasPlaceholderHint: string
    canvasPlaceholder: string
    /** The toast once a newer version of the app is waiting (ticket 69), and its button, which reloads onto it. */
    updateReady: string
    updateReload: string
    /** Under "Update ready"'s open list, the link to the notes it leaves out (ticket 1091); no plural forms. */
    updateMore: string
    /** The dev site's toast for a host sign-in (Cloudflare Access) that has run out, and its button (ticket 1041). Never
     * "Sign in": that is the openbeads account's alone (ticket 0078). */
    accessRunOut: string
    renewAccess: string
    /** The hint's second sentence, how to move the Canvas: its own key so a touch device can say its own (ticket 0840). */
    canvasPlaceholderPan: string
    /** The empty Canvas after a delete left no Project open (ticket 0840): “{name}” was deleted, and what to do next. */
    canvasDeleted: string
    canvasDeletedHint: string
    /** The pan sentence on touch (ticket 0846): fingers, no mouse button or key. */
    canvasPlaceholderPanTouch: string
  }
  /** Storage's own voice in the UI: what it says when a write to this device didn't get through (ticket 55). */
  storage: {
    saveFailedMessage: string
    /** The notice row's line while the open Project is open in another tab first (ticket 0834). */
    openElsewhere: string
    /** The browser's yes, said back once at the first Project file (tickets 0839, 0936); a no says nothing. */
    keptToast: string
    /** The full-page message when the Projects saved on this device couldn't be opened (ticket 1020, spec 1018). */
    libraryUnopened: string
    /** The one action of that message: loads the page again. */
    reload: string
    /** The notice's action while the open Project is open in another tab (ticket 0937): takes it over here. */
    workHere: string
    /** The Project panel's save state there (ticket 0937): nothing drawn here is saved. */
    notSavedHere: string
    /** Why the Tool pill's tools are off there (ticket 0937). */
    toolsOff: string
  }
  /** The header's own addition at the iPad mini tier (ticket 168): the More button (OverflowMenu card). */
  header: {
    menuButton: string
    homepageItem: string
    /** The HeaderMenu's link to the repository (ADR 0031, ticket 269): the AGPL-3.0 network clause requires a hosted
     * copy to offer one. */
    sourceItem: string
    /** The Dock's sixth button and the sheet it opens (ticket 79; Dock/ToolSheet cards): Save/Export, the Bead pill,
     * Beads needed, Saved Projects, New Project, Import. */
    projectPanelLabel: string
    /** The strip's Project button, named with the open Project's name it shows (ticket 0858). */
    projectButtonNamed: string
  }
  size: {
    /** Names the Estimated size readout for assistive technology. */
    estimateLabel: string
    /** The info icon's accessible name; its tooltip is `estimateWarning`. */
    /** The warning tooltip on the Estimated size: it is a guide, not a measurement. */
    estimateWarning: string
    /** Hover/focus text on the Frame's controls while Row progress is on and they are disabled. */
    lockedReason: string
  }
  /** Safe start and the size gate (ticket 0716): the notice of a Project that didn't open last time, and the question
   * before a Project over the gate opens. */
  opening: {
    /** The notice row, with {name}. */
    didNotOpen: string
    removeButton: string
    /** "Open “Scarf”?", with {name}. */
    largeTitle: string
    /** "31 million beads. Opening may be slow or fail.", {count} in millions. */
    largeMessage: string
    openAnyway: string
    cancelButton: string
  }
  /** What an empty field says goes in it (ticket 0854, TextField card): a placeholder, never a value. */
  fields: {
    projectName: string
    frameName: string
    pieceName: string
    feedbackMessage: string
    feedbackShown: string
    feedbackShouldSay: string
    feedbackCode: string
    feedbackLooksLike: string
    feedbackNote: string
    feedbackEmail: string
    /** Under a name edited in place that is longer than the limit, with {max}. */
    tooLong: string
  }
}
