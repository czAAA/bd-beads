import type { Translations } from './translations'

export const en: Translations = {
  app: {
    title: 'bd-beads',
  },
  form: {
    nameLabel: 'Name',
    beadLabel: 'Bead',
    techniqueLabel: 'Technique',
    techniqueLoom: 'Loom',
    techniquePeyote: 'Peyote',
    techniqueBrick: 'Brick stitch',
    widthLabel: 'Width',
    heightLabel: 'Height',
    unitLabel: 'Unit',
    unitMm: 'mm',
    unitCm: 'cm',
    submit: 'Create Pattern',
  },
  languageSwitcher: {
    ariaLabel: 'Language',
  },
  patterns: {
    heading: 'Saved Patterns',
    newPatternButton: 'New Pattern',
    removeButton: 'Remove',
    currentLabel: 'Currently editing',
    unknownBeadLabel: 'Unknown bead',
  },
  canvas: {
    zoomInLabel: 'Zoom in',
    zoomOutLabel: 'Zoom out',
    zoomResetLabel: 'Reset zoom to fit',
  },
  shell: {
    mainPanelPlaceholder: 'Tools — coming soon',
    canvasPlaceholder: 'No Pattern open yet',
  },
  palette: {
    pickerLabel: 'Palette colors',
    colorLabel: 'Color',
    undoButton: 'Undo',
    redoButton: 'Redo',
    rotateButton: 'Rotate',
    customColorLabel: 'Custom color',
  },
  tools: {
    paintLabel: 'Paint',
    fillLabel: 'Fill',
    selectLabel: 'Select',
    copyButton: 'Copy',
  },
  rowProgress: {
    enabledLabel: 'Show row progress',
    directionButton: 'Turn row direction',
    positionLabel: 'Row',
    previousButton: 'Previous row',
    nextButton: 'Row done',
  },
  quantities: {
    heading: 'Beads needed',
    noPatternMessage: 'Open a Pattern to see how many beads it needs',
    noColorsMessage: 'Nothing painted yet',
    colorHeading: 'Color',
    countHeading: 'Beads',
  },
  transfer: {
    heading: 'Export and import',
    exportPatternButton: 'Export Pattern',
    exportLibraryButton: 'Export all Patterns',
    importLabel: 'Import a file',
    importedLabel: 'Patterns imported',
    importErrorLabel: 'Could not import that file',
  },
  mirror: {
    horizontalLabel: 'Horizontal',
    verticalLabel: 'Vertical',
    mirrorCurrentHorizontalButton: 'Mirror current (horizontal)',
    mirrorCurrentVerticalButton: 'Mirror current (vertical)',
  },
  toolbox: {
    groups: {
      tools: 'Tools',
      colors: 'Colors',
      edit: 'Edit',
      mirror: 'Mirror',
      rowProgress: 'Row progress',
    },
  },
  deleteAll: {
    button: 'Delete all',
    confirmTitle: 'Delete all?',
    confirmMessage: 'Every cell will be emptied and Row progress turned off. This can be undone.',
    confirmButton: 'Delete all',
    cancelButton: 'Cancel',
  },
}
