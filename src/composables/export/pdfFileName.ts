import type { Project } from '../../domain/project'
import { projectExportFileName } from '../../domain/projectFile'
import type { Translations } from '../../i18n/translations'
import type { PrintChoices, PrintText } from '../../rendering/printText'

/** The switches the PDF's name says (ticket 1125): Large beads only where the printed words carry it, as only there it
 * acts; none while the words are not worked out yet. */
export function namedChoices(choices: PrintChoices, words: Pick<PrintText, 'largeBeads'> | undefined): PrintChoices {
  return { ...choices, largeBeads: !!words?.largeBeads }
}

/** The name the PDF is saved under (ticket 1096; ExportPanel card): the Project's export name, then a word in the app's
 * language for each print switch that is on, in the panel's order. One place, so the "Saves as" line, the file and its
 * saved-file toast name the same file. */
export function pdfFileName(project: Project, choices: PrintChoices, t: Translations): string {
  const words = [choices.cover && t.frame.fileWordCover, choices.blackAndWhite && t.frame.fileWordBlackAndWhite, choices.emptyGrid && t.frame.fileWordEmptyGrid, choices.chartBorder && t.frame.fileWordChartBorder, choices.largeBeads && t.frame.fileWordLargeBeads, choices.rowByRow && t.frame.fileWordRowByRow]
  return projectExportFileName(project, 'pdf', words.filter((word): word is string => !!word))
}
