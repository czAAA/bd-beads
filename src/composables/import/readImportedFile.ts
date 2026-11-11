import { readProjectsFile, type ReadProjectFile } from '../../services/projectFileCodec'

/** The Projects in a picked `.openbeads` file, or a pre-ADR 0048 `.json` (ticket 392), with their reference images'
 * pictures (ticket 0790); here so the import control, which may not reach services, can read files. */
export function readImportedFile(file: Blob): Promise<ReadProjectFile> {
  return readProjectsFile(file)
}

/** The file types Open Project file offers (ticket 0859): Project files, and the `.json` of builds before ADR 0048. */
const PROJECT_FILE_TYPES = '.openbeads,.json'

/** The picker's filter, where one can work: with no touch, a desktop's dialog filters by ending. iPadOS and phones
 * grey out an ending they know no type for, so there the picker offers every file (ADR 0048, ticket 0469). */
export function projectFileAccept(device: { maxTouchPoints?: number } | undefined = globalThis.navigator): string | undefined {
  return device?.maxTouchPoints === 0 ? PROJECT_FILE_TYPES : undefined
}
