// The design homepage (bd-ux-design skill): every topic in the design root as a titled tile, newest first, so the
// owner browses all sessions' work in one place. Read fresh on every request; the page reloads when a file changes.
import fs from 'node:fs'
import path from 'node:path'

const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const decode = (text) => String(text ?? '').replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" })[e])
const attr = (html, name) => decode(html.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '')
const titleOf = (html) => decode(html.match(/<title>([^<]*)<\/title>/i)?.[1]?.replace(/\s*·\s*design canvas$/, '').trim() ?? '')
const SKIP = /^(node_modules|crops|audit\.(json|txt)|\.server\.json|\.DS_Store)$/

/** The newest change in a folder, a few levels down. */
function newest(dir, depth = 3) {
  let time = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.test(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) time = depth ? Math.max(time, newest(full, depth - 1)) : time
    else time = Math.max(time, fs.statSync(full).mtimeMs)
  }
  return time
}

function openComments(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'comments.json'), 'utf8')).filter((c) => !c.resolved).length
  } catch {
    return 0
  }
}

/** One tile's facts: a canvas topic, an older prototype folder, or a loose page. */
function entries(root) {
  const list = []
  for (const entry of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(root, entry.name)
    const href = '/' + encodeURIComponent(entry.name)
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8')
      list.push({ kind: 'page', slug: entry.name, href, title: titleOf(html) || entry.name, time: fs.statSync(full).mtimeMs, preview: href })
      continue
    }
    if (!entry.isDirectory()) continue
    const canvas = path.join(full, 'canvas.html')
    if (fs.existsSync(canvas)) {
      const html = fs.readFileSync(canvas, 'utf8')
      const main = html.slice(html.indexOf('<main'))
      const options = [...main.matchAll(/\bdata-option="([^"]*)"/g)].length
      const groups = [...main.matchAll(/\bdata-group="/g)].length
      const src = attr(main.slice(main.indexOf('data-option=')), 'data-src')
      list.push({ kind: 'canvas', slug: entry.name, href: `${href}/canvas.html`, title: attr(main, 'data-title') || entry.name,
        question: attr(main, 'data-question'), options, groups, comments: openComments(full), time: newest(full),
        earlier: fs.existsSync(path.join(full, 'canvas-options.html')) ? `${href}/canvas-options.html` : '',
        preview: src ? `${href}/${src}#state=default&theme=light&lang=en` : '' })
      continue
    }
    const index = path.join(full, 'index.html')
    if (fs.existsSync(index)) {
      const html = fs.readFileSync(index, 'utf8')
      // A page that loads TypeScript was run by Vite: this server can't build it, so it gets no preview.
      const vite = /<script[^>]+src="[^"]+\.ts"/.test(html)
      list.push({ kind: 'prototype', slug: entry.name, href: `${href}/index.html`, title: titleOf(html) || entry.name, vite, time: newest(full),
        preview: vite ? '' : `${href}/index.html` })
    }
  }
  return list.sort((a, b) => b.time - a.time)
}

const day = (time) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function tile(item) {
  const facts = item.kind === 'canvas'
    ? [`${item.options} option${item.options === 1 ? '' : 's'}`, item.groups > 1 && `${item.groups} questions`,
        item.comments && `${item.comments} open comment${item.comments === 1 ? '' : 's'}`, day(item.time)]
    : [item.kind === 'page' ? 'single page' : 'prototype', item.vite && 'needs Vite to run', day(item.time)]
  const status = item.kind === 'canvas' && item.earlier ? '<span class="dh-status">Signed off</span>' : ''
  const preview = item.preview
    ? `<iframe src="${escape(item.preview)}" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>`
    : `<span class="dh-empty">${item.vite ? 'Built with Vite: no preview here' : 'No preview'}</span>`
  return `<article class="dh-tile" data-find="${escape([item.title, item.question, item.slug].join(' ').toLowerCase())}">
  <a class="dh-preview" href="${escape(item.href)}" tabindex="-1" aria-hidden="true">${preview}</a>
  <div class="dh-text">
    <h3><a href="${escape(item.href)}">${escape(item.title)}</a>${status}</h3>
    ${item.question ? `<p class="dh-question">${escape(item.question)}</p>` : ''}
    <p class="dh-facts">${facts.filter(Boolean).map(escape).join(' · ')}</p>
    <p class="dh-links"><code>${escape(item.slug)}</code>${item.earlier ? ` <a href="${escape(item.earlier)}">Every option of the round</a>` : ''}</p>
  </div>
</article>`
}

const section = (title, items) => items.length
  ? `<section class="dh-section"><h2>${escape(title)} <span>${items.length}</span></h2><div class="dh-grid">${items.map(tile).join('\n')}</div></section>`
  : ''

/** The homepage's HTML for the design root `root`. */
export function homePage(root) {
  // A topic with nothing to show (an old Vite prototype) is a leftover: it gets no tile.
  const list = entries(root).filter((item) => item.preview)
  const canvases = list.filter((item) => item.kind === 'canvas')
  const older = list.filter((item) => item.kind !== 'canvas')
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Designs</title>
<link rel="stylesheet" href="/_app/styles/fonts.css" />
<link rel="stylesheet" href="/_app/styles/tokens.css" />
<link rel="stylesheet" href="/_app/styles/design-values.css" />
<link rel="stylesheet" href="/_canvas/home.css" />
</head>
<body>
<header class="dh-bar">
  <div><h1>Designs</h1><p>${list.length} in ${escape(root)}</p></div>
  <input type="search" placeholder="Find a design" aria-label="Find a design" />
</header>
<main>
${list.length ? section('design canvases', canvases) + section('older prototypes and pages', older) : '<p class="dh-none">No designs yet. A topic appears here once the bd-ux-design skill scaffolds it.</p>'}
</main>
<script>
  const field = document.querySelector('input[type=search]')
  field.value = sessionStorage.getItem('bd-design:find') ?? ''
  const find = () => {
    const words = field.value.toLowerCase().split(/\\s+/).filter(Boolean)
    sessionStorage.setItem('bd-design:find', field.value)
    for (const tile of document.querySelectorAll('.dh-tile')) tile.hidden = !words.every((w) => tile.dataset.find.includes(w))
    for (const part of document.querySelectorAll('.dh-section')) part.hidden = !part.querySelector('.dh-tile:not([hidden])')
  }
  field.addEventListener('input', find)
  find()
  const y = Number(sessionStorage.getItem('bd-design:y') ?? 0)
  scrollTo(0, y)
  addEventListener('scroll', () => sessionStorage.setItem('bd-design:y', String(scrollY)), { passive: true })
  if (window.EventSource) new EventSource('/api/events').addEventListener('reload', () => location.reload())
</script>
</body>
</html>
`
}
