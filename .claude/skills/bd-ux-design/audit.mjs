#!/usr/bin/env node
// The design audit (bd-ux-design skill): opens every option of a canvas at every size, state, theme and language in
// WebKit at 2× and reports as text what a person would otherwise find by eye. What it checks, its flags and
// `data-audit-ok` are in SKILL.md, step 5. Exit code 1 when anything was found; the full list goes to audit.txt.
import fs from 'node:fs'
import path from 'node:path'
import { loadPlaywright, startServer } from './serve.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const target = args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!target) {
  console.error('usage: node audit.mjs <designDir | canvas.html> [--browser webkit|chromium] [--only <option>@<size>] [--max N]')
  process.exit(2)
}
const dir = path.resolve(target.endsWith('.html') ? path.dirname(target) : target)
const browserName = flag('--browser', 'webkit')
const only = flag('--only')
const maxLines = Number(flag('--max', 40))

/** Runs in the page: every check of one view. Returns [{ kind, where, detail }]. */
function checkView({ states, minTarget, theme }) {
  const found = []
  const ok = (el, kind) => !el.closest(`[data-audit-ok~="${kind}"]`)
  const seen = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true
  const name = (el) => {
    const classes = [...el.classList].slice(0, 2).map((c) => '.' + c).join('')
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + classes
  }
  const sample = (el) => {
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ')
    return text.length > 28 ? text.slice(0, 27) + '…' : text
  }
  const add = (kind, el, detail) => found.push({ kind, where: el ? name(el) : 'page', text: el ? sample(el) : '', detail })
  const px = (n) => Math.round(n * 10) / 10 + 'px'
  const vw = innerWidth
  const vh = innerHeight
  const all = [...document.body.querySelectorAll('*')].filter((el) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName) && seen(el))

  if (document.documentElement.scrollWidth > vw + 1) add('off-screen', null, `the page scrolls sideways by ${px(document.documentElement.scrollWidth - vw)}`)

  // Text: its own drawn box, against its element, every clipping ancestor and the screen.
  const texts = []
  for (const el of all) {
    const nodes = [...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim())
    if (!nodes.length) continue
    const range = document.createRange()
    let box = null
    for (const node of nodes) {
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) {
        if (!r.width || !r.height) continue
        box = box ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
    }
    if (!box) continue
    texts.push({ el, box })
    if (!ok(el, 'clip')) continue
    const style = getComputedStyle(el)
    const clips = (value) => value === 'hidden' || value === 'clip'
    const own = el.getBoundingClientRect()
    if (clips(style.overflowX) && el.scrollWidth > el.clientWidth + 1) add('clipped', el, `text cut off: needs ${px(el.scrollWidth)}, has ${px(el.clientWidth)}`)
    else if (clips(style.overflowY) && el.scrollHeight > el.clientHeight + 1) add('clipped', el, `text cut off: needs ${px(el.scrollHeight)} of height, has ${px(el.clientHeight)}`)
    else if (style.display !== 'inline' && (box.right > own.right + 1 || box.left < own.left - 1)) add('spills', el, `text is ${px(Math.max(box.right - own.right, own.left - box.left))} wider than its box`)
    let fixed = style.position === 'fixed'
    let scrolled = false
    let cut = false
    for (let up = el.parentElement; up && up !== document.documentElement; up = up.parentElement) {
      const upStyle = getComputedStyle(up)
      if (upStyle.position === 'fixed') fixed = true
      if (/auto|scroll/.test(upStyle.overflowX + upStyle.overflowY)) scrolled = true
      if (scrolled || cut || (!clips(upStyle.overflowX) && !clips(upStyle.overflowY))) continue
      const r = up.getBoundingClientRect()
      const over = Math.max(clips(upStyle.overflowX) ? Math.max(box.right - r.right, r.left - box.left) : 0, clips(upStyle.overflowY) ? Math.max(box.bottom - r.bottom, r.top - box.top) : 0)
      if (over > 1) {
        add('clipped', el, `cut off by ${name(up)} by ${px(over)}`)
        cut = true
      }
    }
    const pageScrolls = !/hidden|clip/.test(getComputedStyle(document.documentElement).overflowY + getComputedStyle(document.body).overflowY)
    const out = Math.max(box.right - vw, -box.left, fixed || !pageScrolls ? Math.max(box.bottom - vh, -box.top) : 0)
    if (out > 1 && !scrolled) add('off-screen', el, `${px(out)} of it is outside the ${vw}×${vh} screen`)
  }

  // Overlaps: two texts, or two controls, drawn over each other without one being a layer above the other.
  const cross = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), x: (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2, y: (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2 })
  const layerOf = (el) => {
    for (let up = el; up && up !== document.body; up = up.parentElement) if (/absolute|fixed|sticky/.test(getComputedStyle(up).position)) return up
    return document.body
  }
  const solidBetween = (el, stop) => {
    for (let up = el; up && up !== stop; up = up.parentElement) {
      const style = getComputedStyle(up)
      const channels = style.backgroundColor.match(/[\d.]+/g) ?? []
      const opaque = style.backgroundColor !== 'transparent' && (channels.length < 4 || Number(channels[3]) > 0.5)
      if (opaque || style.backgroundImage !== 'none') return true
    }
    return false
  }
  const common = (a, b) => {
    let up = a
    while (up && !up.contains(b)) up = up.parentElement
    return up
  }
  const overlaps = (items, what) => {
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i]
        const b = items[j]
        if (a.el.contains(b.el) || b.el.contains(a.el) || !ok(a.el, 'overlap') || !ok(b.el, 'overlap')) continue
        const hit = cross(a.box, b.box)
        if (hit.w <= 2 || hit.h <= 2) continue
        if (layerOf(a.el) !== layerOf(b.el)) {
          const at = document.elementFromPoint(hit.x, hit.y)
          const upper = at && (a.el.contains(at) || at.contains(a.el)) ? a : at && (b.el.contains(at) || at.contains(b.el)) ? b : null
          if (!upper || solidBetween(upper.el, common(a.el, b.el))) continue
        }
        add('overlap', a.el, `${what} overlaps ${name(b.el)} by ${px(hit.w)} × ${px(hit.h)}`)
      }
    }
  }
  overlaps(texts, 'text')

  // Controls: overlaps and tap targets (a ::before or ::after that reaches past the control counts as its hit area).
  const controls = all.filter((el) => el.matches('a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"]), [data-goto]'))
    .filter((el) => !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))
    .map((el) => {
      const r = el.getBoundingClientRect()
      const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(el, pseudo)
        if (style.content === 'none' || style.position !== 'absolute') continue
        const reach = (side) => Math.max(0, -(parseFloat(style[side]) || 0))
        box.left -= reach('left')
        box.right += reach('right')
        box.top -= reach('top')
        box.bottom += reach('bottom')
      }
      return { el, box }
    })
  overlaps(controls, 'control')
  for (const { el, box } of controls) {
    const w = box.right - box.left
    const hgt = box.bottom - box.top
    if (ok(el, 'target') && (w < minTarget - 0.5 || hgt < minTarget - 0.5)) add('tap-target', el, `${px(w)} × ${px(hgt)}, under ${minTarget}px`)
  }
  for (const el of document.querySelectorAll('[data-goto]')) if (!states.includes(el.dataset.goto)) add('state', el, `data-goto="${el.dataset.goto}" is not in the canvas's data-states`)

  // Colors and shadows: each must be what some design-system token resolves to in this theme.
  const cache = (window.__auditTokens ??= {})
  if (!cache[theme]) {
    const names = new Set()
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.style) for (const prop of rule.style) if (prop.startsWith('--')) names.add(prop)
        if (rule.cssRules) walk(rule.cssRules)
      }
    }
    for (const sheet of document.styleSheets) if (/\/_app\/styles\/|\/_ds\//.test(sheet.href ?? '')) walk(sheet.cssRules)
    const holder = document.createElement('div')
    holder.style.cssText = 'position:absolute;visibility:hidden;color:rgb(1, 2, 3)'
    const probe = holder.appendChild(document.createElement('i'))
    document.body.append(holder)
    const colors = new Set(['rgba(0, 0, 0, 0)', 'transparent'])
    const shadows = new Set(['none'])
    for (const prop of names) {
      probe.style.color = `var(${prop})`
      probe.style.boxShadow = `var(${prop})`
      const style = getComputedStyle(probe)
      if (style.color !== 'rgb(1, 2, 3)') colors.add(style.color)
      shadows.add(style.boxShadow)
    }
    holder.remove()
    cache[theme] = { colors, shadows, count: names.size }
  }
  const { colors, shadows, count } = cache[theme]
  if (!count) add('color', null, 'no design-system tokens loaded: link /_app/styles/tokens.css')
  else {
    for (const el of [document.documentElement, document.body, ...all]) {
      if (!ok(el, 'color')) continue
      const style = getComputedStyle(el)
      const used = []
      if ([...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) used.push(['text', style.color])
      used.push(['background', style.backgroundColor])
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none') used.push(['border', style[`border${side}Color`]])
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) used.push(['outline', style.outlineColor])
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) for (const prop of ['fill', 'stroke']) if (style[prop] !== 'none' && /^(rgb|color|#)/.test(style[prop])) used.push([prop, style[prop]])
      const bad = new Map(used.filter(([, value]) => !colors.has(value)))
      for (const [part, value] of bad) add('color', el, `${part} ${value} is no token`)
      if (!shadows.has(style.boxShadow)) add('color', el, `shadow ${style.boxShadow} is no token`)
    }
  }
  return found
}

/** Runs in the page just after a state change: what is moving right now. */
function checkMotion() {
  const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target && !a.effect.target.closest('[data-audit-ok~="motion"]'))
  const label = (el) => el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => '.' + c).join('')
  const found = []
  for (const a of running) if (a.effect.getComputedTiming().iterations === Infinity) found.push({ kind: 'motion', where: label(a.effect.target), detail: 'never stops moving' })
  const targets = [...new Set(running.filter((a) => a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.effect.target))]
  const movers = targets.filter((el) => !targets.some((other) => other !== el && other.contains(el)))
  if (movers.length > 1) found.push({ kind: 'motion', where: 'page', detail: `${movers.length} things move at once: ${movers.slice(0, 4).map(label).join(', ')}` })
  return found
}

const settle = (page) => page.evaluate(() => Promise.race([
  Promise.all([document.fonts.ready, ...document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))]).then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))),
  new Promise((done) => setTimeout(done, 2000)),
]))

const playwright = loadPlaywright()
const server = await startServer({ dir, port: 0, watch: false })
const browser = await playwright[browserName].launch()
const origin = new URL(server.url).origin
const findings = []
let views = 0
try {
  const first = await browser.newPage({ viewport: { width: 1710, height: 907 }, deviceScaleFactor: 2 })
  const trouble = []
  first.on('pageerror', (error) => trouble.push(String(error.message)))
  first.on('response', (response) => response.status() >= 400 && !new URL(response.url()).pathname.startsWith('/options/') && trouble.push(`${response.status()} ${new URL(response.url()).pathname}`))
  await first.goto(`${origin}/canvas.html?static`)
  const canvas = await first.evaluate(() => window.designCanvas)
  if (!canvas?.boards.length) throw new Error('canvas.html lists no options (window.designCanvas is empty)')
  for (const text of trouble) findings.push({ board: 'canvas', view: '', kind: 'error', where: 'canvas.html', detail: text })
  await first.close()

  const boards = canvas.boards.filter((board) => !only || board.id === only || board.option === only)
  for (const board of boards) {
    const touch = board.size !== 'desktop'
    const context = await browser.newContext({ viewport: { width: board.width, height: board.height }, deviceScaleFactor: 2, hasTouch: touch })
    const page = await context.newPage()
    const errors = new Set()
    page.on('pageerror', (error) => errors.add(String(error.message)))
    page.on('console', (message) => message.type() === 'error' && !message.text().startsWith('Failed to load resource') && errors.add(message.text()))
    page.on('response', (response) => response.status() >= 400 && errors.add(`${response.status()} ${new URL(response.url()).pathname}`))
    const url = (state, theme, lang) => `${origin}/${board.src}#` + new URLSearchParams({ state, theme, lang })
    await page.goto(url(board.states[0], canvas.themes[0], canvas.langs[0]))
    await settle(page)
    if (!(await page.evaluate(() => Boolean(window.design)))) findings.push({ board: board.id, view: '', kind: 'error', where: board.src, detail: 'option.js is not loaded: add <script src="/_canvas/option.js"></script>' })
    for (const lang of canvas.langs.slice(1)) {
      const has = await page.evaluate((key) => [...document.querySelectorAll('*')].some((el) => key in el.dataset), 't' + lang[0].toUpperCase() + lang.slice(1).replace(/-(.)/g, (_, c) => c.toUpperCase()))
      if (!has) findings.push({ board: board.id, view: '', kind: 'copy', where: board.src, detail: `no data-t-${lang} text anywhere: the ${lang} view shows English` })
    }
    // Every data-goto control, really pressed from the state it shows in: the press must land and show its state.
    const firstHash = (state) => url(state, canvas.themes[0], canvas.langs[0]).split('#')[1]
    for (const state of board.states) {
      await page.evaluate((hash) => (location.hash = hash), firstHash(state))
      await settle(page)
      const count = await page.locator('[data-goto]').count()
      for (let i = 0; i < count; i += 1) {
        const control = page.locator('[data-goto]').nth(i)
        if (!(await control.isVisible())) continue
        const goto = await control.getAttribute('data-goto')
        if (!board.states.includes(goto)) continue
        const label = await control.evaluate((el) => el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => '.' + c).join(''))
        const expected = goto === state ? 'default' : goto
        const pressed = await control.click({ timeout: 1500 }).then(() => true, () => false)
        const now = await page.evaluate(() => document.documentElement.dataset.state)
        if (!pressed) findings.push({ board: board.id, view: `${state}/${canvas.themes[0]}/${canvas.langs[0]}`, kind: 'press', where: label, detail: 'can\'t be pressed: something covers it or it is off the screen' })
        else if (now !== expected) findings.push({ board: board.id, view: `${state}/${canvas.themes[0]}/${canvas.langs[0]}`, kind: 'press', where: label, detail: `a press shows "${now}", not "${expected}"` })
        await page.evaluate((hash) => (location.hash = hash), firstHash(state))
        await settle(page)
      }
    }
    for (const theme of canvas.themes) {
      for (const lang of canvas.langs) {
        for (const state of board.states) {
          const view = `${state}/${theme}/${lang}`
          if (theme === canvas.themes[0] && lang === canvas.langs[0] && state !== board.states[0]) {
            await page.evaluate((hash) => (location.hash = hash), url(board.states[0], theme, lang).split('#')[1])
            await settle(page)
            await page.evaluate((hash) => (location.hash = hash), url(state, theme, lang).split('#')[1])
            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
            for (const item of await page.evaluate(checkMotion)) findings.push({ board: board.id, view, ...item })
          } else {
            await page.evaluate((hash) => (location.hash = hash), url(state, theme, lang).split('#')[1])
          }
          await settle(page)
          views += 1
          for (const item of await page.evaluate(checkView, { states: board.states, minTarget: touch ? 44 : 24, theme })) findings.push({ board: board.id, view, ...item })
        }
      }
    }
    for (const text of errors) findings.push({ board: board.id, view: '', kind: 'error', where: board.src, detail: text })
    await context.close()
  }

  // One line per distinct finding, with the views it shows in.
  const groups = new Map()
  for (const item of findings) {
    const key = [item.board, item.kind, item.where, item.detail].join(' | ')
    if (!groups.has(key)) groups.set(key, { ...item, views: [] })
    if (item.view) groups.get(key).views.push(item.view)
  }
  const perBoard = (board) => (canvas.boards.find((b) => b.id === board)?.states.length ?? 1) * canvas.themes.length * canvas.langs.length
  const lines = [...groups.values()].map((g) => {
    const parts = [0, 1, 2].map((i) => [...new Set(g.views.map((v) => v.split('/')[i]))].join(','))
    const where = !g.views.length ? '' : g.views.length === perBoard(g.board) ? '  [every view]' : `  [${parts.join(' / ')}]`
    return `${g.board.padEnd(16)} ${g.kind.padEnd(10)} ${g.where}${g.text ? ` "${g.text}"` : ''}: ${g.detail}${where}`
  })
  const head = `audit: ${browserName} at 2×, ${boards.length} artboards, ${views} views (state × theme × language)`
  const tail = lines.length ? `${lines.length} distinct findings (${findings.length} in all)` : 'clean: nothing found'
  fs.writeFileSync(path.join(dir, 'audit.txt'), [head, ...lines, tail].join('\n') + '\n')
  fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify({ browser: browserName, views, findings: [...groups.values()] }, null, 2) + '\n')
  console.log(head)
  for (const line of lines.slice(0, maxLines)) console.log(line)
  if (lines.length > maxLines) console.log(`… ${lines.length - maxLines} more in audit.txt`)
  console.log(tail)
  process.exitCode = lines.length ? 1 : 0
} finally {
  await browser.close()
  await server.close()
}
