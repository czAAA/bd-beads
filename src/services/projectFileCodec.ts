import { parseProjectsFile, serializeLibrary, serializeProject, type ProjectFileContents } from '../domain/projectFile'
import type { Project } from '../domain/project'
import { parseLegacyProjectsFile } from './legacyProjectFile'

/**
 * Turns Project files into the gzipped bytes of a `.openbeads` file and back (ADR 0048), with the browser's own
 * CompressionStream: this is the service so the domain keeps only the JSON.
 */

async function pipeThrough(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const piped = new Response(bytes).body!.pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return pipeThrough(new TextEncoder().encode(text), new CompressionStream('gzip'))
}

/** The open Project as the bytes of a `.openbeads` file (ticket 12). */
export function packProjectFile(project: Project): Promise<Uint8Array<ArrayBuffer>> {
  return gzip(serializeProject(project))
}

/** Every saved Project as the bytes of a `.openbeads` file (ticket 15). */
export function packLibraryFile(projects: Project[]): Promise<Uint8Array<ArrayBuffer>> {
  return gzip(serializeLibrary(projects))
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b
}

/**
 * Reads the Projects out of a picked file: gzip (by its magic bytes) goes to the current reader, anything else to the
 * deprecated JSON reader. Throws, importing nothing, for a file that is neither, an unknown version, or a gzip that
 * doesn't unpack.
 */
export async function readProjectsFile(file: Blob): Promise<ProjectFileContents> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isGzip(bytes)) {
    return parseLegacyProjectsFile(new TextDecoder().decode(bytes))
  }
  const unpacked = await pipeThrough(bytes, new DecompressionStream('gzip'))
  return parseProjectsFile(new TextDecoder().decode(unpacked))
}
