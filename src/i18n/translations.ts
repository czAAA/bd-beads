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
  }
  canvas: {
    zoomInLabel: string
    zoomOutLabel: string
    zoomResetLabel: string
  }
  shell: {
    mainPanelPlaceholder: string
    canvasPlaceholder: string
  }
  palette: {
    pickerLabel: string
    colorLabel: string
    undoButton: string
    rotateButton: string
  }
  tools: {
    paintLabel: string
    fillLabel: string
    selectLabel: string
    copyButton: string
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
  transfer: {
    heading: string
    exportPatternButton: string
    exportLibraryButton: string
    importLabel: string
    importedLabel: string
    importErrorLabel: string
  }
  mirror: {
    horizontalLabel: string
    verticalLabel: string
    mirrorCurrentHorizontalButton: string
    mirrorCurrentVerticalButton: string
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
  catalog: {
    heading: string
    brandLabel: string
    nameLabel: string
    sizeLabel: string
    formFactorLabel: string
    formFactorCube: string
    formFactorRound: string
    formFactorCylinder: string
    colorLabel: string
    widthLabel: string
    heightLabel: string
    addButton: string
    editButton: string
    removeButton: string
    saveButton: string
    cancelButton: string
  }
}
