import { parseProjectsFile, serializeLibrary, serializeProject, serializeStoredProject, type FilePictures } from '../domain/projectFile'
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

/** Reference image pictures by Project id, as the device keeps them (ADR 0089). */
export type PictureBlobs = ReadonlyMap<string, Blob>

/** How many bytes go to `String.fromCharCode` at once: its arguments are limited. */
const BASE64_CHUNK = 0x8000

async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let at = 0; at < bytes.length; at += BASE64_CHUNK) binary += String.fromCharCode(...bytes.subarray(at, at + BASE64_CHUNK))
  return btoa(binary)
}

/** The pictures as a file carries them (ADR 0089): base64, by Project id. */
async function filePictures(pictures: PictureBlobs): Promise<FilePictures> {
  return Object.fromEntries(await Promise.all([...pictures].map(async ([id, blob]) => [id, await base64Of(blob)] as const)))
}

/** The open Project as the bytes of a `.openbeads` file (ticket 12), with its reference image's picture (ticket 0790). */
export async function packProjectFile(project: Project, pictures: PictureBlobs = new Map()): Promise<Uint8Array<ArrayBuffer>> {
  return gzip(serializeProject(project, await filePictures(pictures)))
}

/** Every saved Project as the bytes of a `.openbeads` file (ticket 15), sealed ones from their stored form (ticket 0716),
 * with every reference image's picture (ticket 0790). */
export async function packLibraryFile(projects: Project[], stored: readonly string[] = [], pictures: PictureBlobs = new Map()): Promise<Uint8Array<ArrayBuffer>> {
  return gzip(serializeLibrary(projects, stored, await filePictures(pictures)))
}

/** A Project in its stored form as the bytes of a `.openbeads` file, without decoding it (ticket 0716). */
export async function packStoredProjectFile(stored: string, pictures: PictureBlobs = new Map()): Promise<Uint8Array<ArrayBuffer>> {
  return gzip(serializeStoredProject(stored, await filePictures(pictures)))
}

// Limits on a picked file (ticket 469), against a crafted "gzip bomb" (ADR 0048), raised for reference images (ADR
// 0089): over 200 MB is refused unread, and unpacking aborts, counting streamed bytes, past 300 MB.
/** The largest picked file read at all.
 * @internal Its test tries a file just over the cap. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024
/** The most a gzip may unpack to before reading aborts.
 * @internal Its test tries a gzip that unpacks just over the cap. */
export const MAX_UNPACKED_BYTES = 300 * 1024 * 1024

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

/** What a picked file holds: its Projects, and their reference images' pictures by the ids the file gave them. */
export interface ReadProjectFile {
  projects: Project[]
  pictures: PictureBlobs
}

/** A file's pictures as Blobs, each of its Project's recorded type; one whose Project has no reference image is dropped. */
function pictureBlobs(projects: readonly Project[], pictures: FilePictures): PictureBlobs {
  const blobs = new Map<string, Blob>()
  for (const project of projects) {
    const data = pictures[project.id]
    if (data === undefined || !project.referenceImage) continue
    try {
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at)
      blobs.set(project.id, new Blob([bytes], { type: project.referenceImage.picture.type }))
    } catch {
      // Not base64: the Project opens with its settings and no picture to show.
    }
  }
  return blobs
}

// Reads Projects from a picked file: gzip (by magic bytes) to the current reader, else the legacy JSON reader. Throws,
// importing nothing, on bad input.
export async function readProjectsFile(file: Blob): Promise<ReadProjectFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Project file is over the size limit')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isGzip(bytes)) {
    return { projects: parseLegacyProjectsFile(new TextDecoder().decode(bytes)).projects, pictures: new Map() }
  }
  const unpacked = await unpack(bytes)
  const contents = parseProjectsFile(new TextDecoder().decode(unpacked))
  return { projects: contents.projects, pictures: pictureBlobs(contents.projects, contents.pictures) }
}
