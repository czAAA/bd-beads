#!/usr/bin/env node
// The local design server (bd-ux-design skill): serves one design folder with the repo's tokens, fonts and icons,
// keeps its comments.json, and tells the open page to reload when a file changes. 127.0.0.1 only, no dependencies.
// Usage: run it with no arguments, or see SKILL.md, steps 6 and 7.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execFile, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, '../../..')
const FIRST_PORT = 4310

/** Playwright from this checkout's node_modules, or the main checkout's when a worktree has none. */
export function loadPlaywright() {
  const roots = [REPO]
  try {
    roots.push(path.dirname(execFileSync('git', ['-C', REPO, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim()))
  } catch {
    // Not a git checkout: the one root has to do.
  }
  for (const root of roots) {
    try {
      return createRequire(path.join(root, 'package.json'))('playwright')
    } catch {
      // Try the next root.
    }
  }
  throw new Error('playwright not found: run `npm ci` in the repo')
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
}

/** Where an address is read from: the mounts first, then the design folder, then the app's `public/`. */
function mounts(dir) {
  return [
    ['/_canvas/', HERE],
    ['/_ds/', path.join(REPO, 'docs/design/system')],
    ['/_app/styles/', path.join(REPO, 'src/styles')],
    ['/fonts/', path.join(REPO, 'public/fonts')],
    ['/', dir],
    ['/', path.join(REPO, 'public')],
  ]
}

function resolveFile(dir, urlPath) {
  for (const [prefix, root] of mounts(dir)) {
    if (!urlPath.startsWith(prefix)) continue
    const file = path.resolve(root, '.' + path.sep + urlPath.slice(prefix.length))
    if (file !== root && !file.startsWith(root + path.sep)) continue
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  }
  return null
}

function readComments(file) {
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeComments(file, list) {
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n')
}

function body(req) {
  return new Promise((resolve, reject) => {
    let text = ''
    req.on('data', (chunk) => {
      text += chunk
      if (text.length > 100_000) reject(new Error('too large'))
    })
    req.on('end', () => {
      try {
        resolve(text ? JSON.parse(text) : {})
      } catch (error) {
        reject(error)
      }
    })
  })
}

const COMMENT_FIELDS = ['board', 'state', 'theme', 'lang', 'x', 'y', 'target', 'text', 'resolved', 'reply']
const pick = (from) => Object.fromEntries(COMMENT_FIELDS.filter((key) => key in from).map((key) => [key, from[key]]))

/** Starts the server for one design folder. `port` 0 takes any free port; otherwise the first free from `port` up. */
export async function startServer({ dir, port = FIRST_PORT, watch = true }) {
  const commentsFile = path.join(dir, 'comments.json')
  const listeners = new Set()
  const send = (res, status, data, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data))
  }

  async function comments(req, res, id) {
    const list = readComments(commentsFile)
    if (req.method === 'GET') return send(res, 200, list)
    if (req.method === 'POST' && !id) {
      const given = pick(await body(req))
      if (!given.text || !String(given.text).trim()) return send(res, 400, { error: 'text is required' })
      const comment = {
        id: list.reduce((max, c) => Math.max(max, c.id), 0) + 1,
        board: '', state: 'default', x: 0, y: 0, resolved: false, reply: '',
        ...given,
        created: new Date().toISOString(),
      }
      writeComments(commentsFile, [...list, comment])
      return send(res, 201, comment)
    }
    const at = list.findIndex((c) => String(c.id) === id)
    if (at < 0) return send(res, 404, { error: 'no such comment' })
    if (req.method === 'PATCH') {
      list[at] = { ...list[at], ...pick(await body(req)) }
      writeComments(commentsFile, list)
      return send(res, 200, list[at])
    }
    if (req.method === 'DELETE') {
      writeComments(commentsFile, list.filter((_, i) => i !== at))
      return send(res, 200, { deleted: Number(id) })
    }
    return send(res, 405, { error: 'method not allowed' })
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      // Only this Mac's own pages: another site's page, or a name pointed at 127.0.0.1, is refused.
      const local = (host) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host ?? '')
      if (!local(req.headers.host) || (req.headers.origin && !local(new URL(req.headers.origin).host))) return send(res, 403, { error: 'local only' })
      const urlPath = decodeURIComponent(url.pathname)
      const api = urlPath.match(/^\/api\/comments(?:\/(\d+))?$/)
      if (api) return await comments(req, res, api[1])
      if (urlPath === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
        res.write('retry: 1000\n\n')
        listeners.add(res)
        req.on('close', () => listeners.delete(res))
        return
      }
      const file = resolveFile(dir, urlPath === '/' ? '/canvas.html' : urlPath)
      if (!file) return send(res, 404, `not found: ${urlPath}`, 'text/plain; charset=utf-8')
      send(res, 200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    } catch (error) {
      send(res, 500, { error: String(error.message ?? error) })
    }
  })

  let watcher
  if (watch) {
    let timer
    const pending = new Set()
    watcher = fs.watch(dir, { recursive: true }, (_event, name) => {
      if (!name || /(^|\/)(\.server\.json|audit\.(json|txt)|crops\/|\.DS_Store)/.test(name)) return
      pending.add(name === 'comments.json' ? 'comments' : 'reload')
      clearTimeout(timer)
      timer = setTimeout(() => {
        const event = pending.has('reload') ? 'reload' : 'comments'
        pending.clear()
        for (const res of listeners) res.write(`event: ${event}\ndata: 1\n\n`)
      }, 120)
    })
  }

  const listen = (tryPort) =>
    new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(tryPort, '127.0.0.1', () => {
        server.off('error', reject)
        resolve(server.address().port)
      })
    })
  let bound
  for (let tryPort = port; bound === undefined; tryPort += 1) {
    try {
      bound = await listen(tryPort)
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || port === 0 || tryPort > port + 60) throw error
    }
  }
  return {
    port: bound,
    url: `http://127.0.0.1:${bound}/canvas.html`,
    close: () => {
      watcher?.close()
      for (const res of listeners) res.end()
      return new Promise((resolve) => server.close(resolve))
    },
  }
}

function running(stateFile) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    process.kill(state.pid, 0)
    return state
  } catch {
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dir = path.resolve(args[0] ?? '')
  if (!args.length || !fs.existsSync(path.join(dir, 'canvas.html'))) {
    console.error('usage: node serve.mjs <designDir with canvas.html> [--open] [--port N]   start, or name the one running\n' +
      '       node serve.mjs <designDir> --stop | --comments [--all] | --resolve <id> "<reply>"')
    process.exit(2)
  }
  const commentsFile = path.join(dir, 'comments.json')
  if (args.includes('--comments')) {
    const list = readComments(commentsFile).filter((c) => args.includes('--all') || !c.resolved)
    for (const c of list) {
      const on = c.target ? ` on ${c.target}` : ''
      console.log(`#${c.id} ${c.board} [${c.state}/${c.theme ?? '-'}/${c.lang ?? '-'}] at ${c.x},${c.y}${on}: ${c.text}${c.resolved ? `  (resolved: ${c.reply})` : ''}`)
    }
    console.log(list.length ? `${list.length} ${args.includes('--all') ? 'in all' : 'open'}` : 'no open comments')
    return
  }
  if (args.includes('--resolve')) {
    const [id, reply = ''] = args.slice(args.indexOf('--resolve') + 1)
    const list = readComments(commentsFile)
    const comment = list.find((c) => String(c.id) === id)
    if (!comment) return console.error(`no comment #${id}`), process.exit(1)
    Object.assign(comment, { resolved: true, reply })
    writeComments(commentsFile, list)
    return console.log(`#${id} resolved`)
  }
  const stateFile = path.join(dir, '.server.json')
  const open = (url) => args.includes('--open') && execFile('open', ['-a', 'Safari', url])
  const already = running(stateFile)
  if (args.includes('--stop')) {
    if (already) process.kill(already.pid)
    fs.rmSync(stateFile, { force: true })
    console.log(already ? `stopped ${already.url}` : 'not running')
    return
  }
  if (already) {
    console.log(already.url)
    open(already.url)
    return
  }
  const portArg = args.indexOf('--port')
  const { url, port } = await startServer({ dir, port: portArg >= 0 ? Number(args[portArg + 1]) : FIRST_PORT })
  fs.writeFileSync(stateFile, JSON.stringify({ pid: process.pid, port, url }) + '\n')
  const bye = () => {
    fs.rmSync(stateFile, { force: true })
    process.exit(0)
  }
  process.on('SIGINT', bye)
  process.on('SIGTERM', bye)
  console.log(url)
  open(url)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
