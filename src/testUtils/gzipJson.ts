/** The bytes of a `.openbeads` file for a Project file's JSON (ticket 392), for a test that picks one. */
export async function gzipJson(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const piped = new Response(text).body!.pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(piped).arrayBuffer())
}
