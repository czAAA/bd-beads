import type { ProjectFileContents } from '../../domain/projectFile'
import { readProjectsFile } from '../../services/projectFileCodec'

/** The Projects in a picked `.openbeads` file, or a pre-ADR 0048 `.json` (ticket 392); here so the import control,
 * which may not reach services, can read files. */
export function readImportedFile(file: Blob): Promise<ProjectFileContents> {
  return readProjectsFile(file)
}
