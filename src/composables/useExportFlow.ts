import { ref, toRaw } from 'vue'
import { downloadFile } from '../domain/fileDownload'
import { loadMakerName, saveMakerName } from '../domain/makerName'
import type { Pattern } from '../domain/pattern'
import { libraryFileName, patternExportFileName, patternFileName, serializeLibrary, serializePattern } from '../domain/patternFile'
import type { Locale, Translations } from '../i18n/translations'
import { exportPatternPdf, exportPatternPng } from '../rendering/patternExport'
import { printText } from '../rendering/printText'
import { useQrExport } from './useQrExport'

/** What exporting needs from the app shell: the open Pattern and the library, the code's settled Pattern, and the app's language. */
export interface ExportFlowDeps {
  currentPattern: () => Pattern | undefined
  patterns: () => Pattern[]
  /** The open Pattern for the QR code, which waits for a stroke to end (see useSettledPattern). */
  shareablePattern: () => Pattern | undefined
  messages: () => Translations
  locale: () => Locale
}

/**
 * Exporting a Pattern (tickets 68, 73, 74, 158, 161, 202; ADR 0023): as a Pattern file, a PNG, a PDF or a QR code, and
 * the maker's name the PNG and PDF print. QR is useQrExport's own; this composable builds on it. Deps are read lazily.
 */
export function useExportFlow(deps: ExportFlowDeps) {
  /**
   * QR export (ticket 68, 116): the Toolbox's Edit group opens the panel and App shows it, so its state lives outside
   * either. The code reads every bead of the Pattern, so it waits for a stroke to end rather than being worked out on
   * each step of it.
   */
  const qrExport = useQrExport(deps.shareablePattern)

  /**
   * The maker's name for the PDF and PNG exports (ticket 161; CONTEXT.md): kept on this device like the theme, set from
   * the Export menu's last row through its modal.
   */
  const makerName = ref(loadMakerName())
  const nameOnExportsOpen = ref(false)

  function onSaveMakerName(name: string) {
    makerName.value = saveMakerName(name)
    nameOnExportsOpen.value = false
  }

  /** Which export is being drawn, if any: the save box says so while it takes a while (ticket 158). Drawing a large Pattern takes a moment, so the buttons wait until it is done. */
  const exporting = ref<'png' | 'pdf' | undefined>()

  async function runExport(make: (pattern: Pattern) => Promise<Blob>, extension: 'png' | 'pdf', type: string) {
    const pattern = deps.currentPattern()
    if (!pattern || exporting.value) {
      return
    }
    exporting.value = extension
    try {
      // Read as the Pattern itself, as the QR export does: drawing reads every bead.
      downloadFile(patternExportFileName(pattern, extension), await make(toRaw(pattern)), type)
    } finally {
      exporting.value = undefined
    }
  }

  /**
   * Export Pattern as the way out (ticket 158; forms-and-states.md): the open Pattern as a Pattern file, offered when a
   * save fails and when a Pattern is too large for a QR code. With none open, a failed save offers the whole library.
   */
  function onExportPatternFile() {
    const pattern = deps.currentPattern()
    if (pattern) {
      downloadFile(patternFileName(pattern), serializePattern(pattern))
    } else {
      downloadFile(libraryFileName(), serializeLibrary(deps.patterns()))
    }
  }

  function onExportPng() {
    // The words the picture prints (ticket 164), in the app's language, with the maker's name (ticket 161).
    return runExport(
      (pattern) => exportPatternPng(pattern, printText(pattern, deps.messages(), deps.locale(), makerName.value, new Date())),
      'png',
      'image/png',
    )
  }

  function onExportPdf() {
    // The words the pages print (ticket 162), in the app's language, with the maker's name (ticket 161).
    return runExport(
      (pattern) => exportPatternPdf(pattern, printText(pattern, deps.messages(), deps.locale(), makerName.value, new Date())),
      'pdf',
      'application/pdf',
    )
  }

  return { qrExport, makerName, nameOnExportsOpen, onSaveMakerName, exporting, onExportPatternFile, onExportPng, onExportPdf }
}
