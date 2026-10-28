import { parseProjectsFile, serializeLibrary, serializeProject, type ProjectFileContents } from '../domain/projectFile'
import type { Project } from '../domain/project'
import { parseLegacyProjectsFile } from './legacyProjectFile'

// Project files to and from gzipped `.openbeads` bytes (ADR 0048) with the browser's CompressionStream; the domain
// keeps only the JSON.

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

// Limits on a picked file (ticket 469), against a crafted "gzip bomb" (real files are tiny, ADR 0048): over 25 MB is
// refused unread, and unpacking aborts, counting streamed bytes, past 100 MB.
/** The largest picked file read at all.
 * @internal Its test tries a file just over the cap. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024
/** The most a gzip may unpack to before reading aborts.
 * @internal Its test tries a gzip that unpacks just over the cap. */
export const MAX_UNPACKED_BYTES = 100 * 1024 * 1024

async function unpack(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip')).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_UNPACKED_BYTES) {
      await reader.cancel()
      throw new Error('Project file unpacks past the size limit')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b
}

// Reads Projects from a picked file: gzip (by magic bytes) to the current reader, else the legacy JSON reader. Throws,
// importing nothing, on bad input.
export async function readProjectsFile(file: Blob): Promise<ProjectFileContents> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Project file is over the size limit')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isGzip(bytes)) {
    return parseLegacyProjectsFile(new TextDecoder().decode(bytes))
  }
  const unpacked = await unpack(bytes)
  return parseProjectsFile(new TextDecoder().decode(unpacked))
}
