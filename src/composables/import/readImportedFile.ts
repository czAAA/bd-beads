import type { ProjectFileContents } from '../../domain/projectFile'
import { readProjectsFile } from '../../services/projectFileCodec'

/**
 * The Projects in a file the person picked: a `.openbeads` file, or a plain `.json` one from before ADR 0048 (ticket
 * 392). It is here so the import control, which may not reach services, reads files through the composables layer.
 */
export function readImportedFile(file: Blob): Promise<ProjectFileContents> {
  return readProjectsFile(file)
}
