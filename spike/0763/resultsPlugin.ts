// Spike 0763: the dev server keeps what the spike page sends to POST /spike-0763/results, one JSON file per device and
// browser, in spike/0763/.work/results/ (gitignored), so an iPad's run lands on the Mac without moving a file by hand.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const MAX_BYTES = 10_000_000

export function spikeResults(): Plugin {
  const folder = resolve(import.meta.dirname, '.work/results')
  return {
    name: 'spike-0763-results',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/spike-0763/results', (req, res) => {
        if (req.method !== 'POST') return void res.writeHead(405).end()
        const chunks: Buffer[] = []
        let size = 0
        req.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size <= MAX_BYTES) chunks.push(chunk)
        })
        req.on('end', () => {
          if (size > MAX_BYTES) return void res.writeHead(413).end()
          const name = String(new URL(req.url ?? '', 'http://x').searchParams.get('name')).replace(/[^\w-]+/g, '-').slice(0, 80)
          mkdirSync(folder, { recursive: true })
          writeFileSync(resolve(folder, `${name}.json`), Buffer.concat(chunks))
          res.writeHead(204).end()
        })
      })
    },
  }
}
