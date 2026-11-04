import { readProjectsFile, type ReadProjectFile } from '../../services/projectFileCodec'

/** The Projects in a picked `.openbeads` file, or a pre-ADR 0048 `.json` (ticket 392), with their reference images'
 * pictures (ticket 0790); here so the import control, which may not reach services, can read files. */
export function readImportedFile(file: Blob): Promise<ReadProjectFile> {
  return readProjectsFile(file)
}
