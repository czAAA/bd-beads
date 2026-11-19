import type { Project } from '../../domain/project'
import { projectExportFileName } from '../../domain/projectFile'
import type { Translations } from '../../i18n/translations'
import type { PrintChoices } from '../../rendering/printText'

/** The name the PDF is saved under (ticket 1096; ExportPanel card): the Project's export name, then a word in the app's
 * language for each print switch that is on, in the panel's order. One place, so the "Saves as" line, the file and its
 * saved-file toast name the same file. */
export function pdfFileName(project: Project, choices: PrintChoices, t: Translations): string {
  const words = [choices.largeBeads && t.frame.fileWordLargeBeads, choices.rowByRow && t.frame.fileWordRowByRow]
  return projectExportFileName(project, 'pdf', words.filter((word): word is string => !!word))
}
