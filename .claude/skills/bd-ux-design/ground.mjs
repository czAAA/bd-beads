#!/usr/bin/env node
// Grounds a design in the real app (bd-ux-design skill): opens a running dev server in WebKit at 2× and prints what a
// part really is, as text: its box, type, colors, radius and shadow, each named by its design-system token.
// Usage and flags: run it with no arguments, or see SKILL.md, step 2.
import { loadPlaywright } from './serve.mjs'

const args = process.argv.slice(2)
const flags = {}
const dos = []
const rest = []
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--do') dos.push(args[(i += 1)])
  else if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[(i += 1)]
  else rest.push(args[i])
}
const [url, selector] = rest
if (!url || !selector) {
  console.error('usage: node ground.mjs <url> <selector> [--size desktop|ipad|WxH] [--theme t] [--lang l] [--depth n]\n' +
    '       [--do click:<sel> | hover:<sel> | wait:<ms>]… [--shot file.png (cropped to the part, at 1×)] [--browser chromium]')
  process.exit(2)
}
const SIZES = { desktop: [1710, 907], ipad: [1366, 1024], 'ipad-portrait': [1024, 1366], phone: [390, 844] }
const [width, height] = SIZES[flags.size ?? 'desktop'] ?? flags.size.split('x').map(Number)

/** Runs in the page: the part and its descendants as lines of text, values named by token where one matches. */
function describe({ selector, depth }) {
  const root = document.querySelector(selector)
  if (!root) return null
  const names = new Set()
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.style) for (const prop of rule.style) if (prop.startsWith('--')) names.add(prop)
      if (rule.cssRules) walk(rule.cssRules)
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules)
    } catch {
      // A sheet from another origin can't be read.
    }
  }
  const holder = document.createElement('div')
  holder.style.cssText = 'position:absolute;visibility:hidden;color:rgb(1, 2, 3)'
  const probe = holder.appendChild(document.createElement('i'))
  document.body.append(holder)
  const tokens = { color: new Map(), shadow: new Map(), font: new Map(), length: new Map() }
  const fontOf = (style) => `${style.fontStyle === 'normal' ? '' : style.fontStyle + ' '}${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily.split(',')[0]}`
  for (const prop of names) {
    probe.style.cssText = `color:var(${prop});box-shadow:var(${prop})`
    let style = getComputedStyle(probe)
    if (style.color !== 'rgb(1, 2, 3)' && !tokens.color.has(style.color)) tokens.color.set(style.color, prop)
    if (style.boxShadow !== 'none' && !tokens.shadow.has(style.boxShadow)) tokens.shadow.set(style.boxShadow, prop)
    if (prop.startsWith('--type-')) {
      probe.style.cssText = `font:var(${prop})`
      style = getComputedStyle(probe)
      if (!tokens.font.has(fontOf(style))) tokens.font.set(fontOf(style), prop)
    }
    if (/^--(radius|space)-/.test(prop)) {
      probe.style.cssText = `width:var(${prop})`
      const px = getComputedStyle(probe).width
      const group = prop.split('-')[2]
      if (!tokens.length.has(group + px)) tokens.length.set(group + px, prop)
    }
  }
  holder.remove()
  const named = (map, value, key = value) => (map.has(key) ? `${map.get(key)} (${value})` : value)
  const lengths = (group, value) => value.split(' ').map((part) => (tokens.length.has(group + part) ? tokens.length.get(group + part) : part)).join(' ')
  const lines = []
  const visit = (el, level) => {
    const style = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return
    const text = [...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim()).map((node) => node.textContent.trim()).join(' ')
    const parts = [`${Math.round(r.width * 10) / 10}×${Math.round(r.height * 10) / 10} at ${Math.round(r.left)},${Math.round(r.top)}`]
    if (text) parts.push(`text "${text.length > 40 ? text.slice(0, 39) + '…' : text}"`, `font ${named(tokens.font, fontOf(style))}`, `color ${named(tokens.color, style.color)}`)
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') parts.push(`bg ${named(tokens.color, style.backgroundColor)}`)
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') parts.push(`border ${style.borderTopWidth} ${named(tokens.color, style.borderTopColor)}`)
    if (style.borderTopLeftRadius !== '0px') parts.push(`radius ${lengths('radius', style.borderRadius)}`)
    if (style.padding !== '0px') parts.push(`padding ${lengths('space', style.padding)}`)
    if (/flex|grid/.test(style.display)) parts.push(`${style.display}${style.display.includes('flex') ? ' ' + style.flexDirection : ''} gap ${lengths('space', style.gap)}`)
    if (style.boxShadow !== 'none') parts.push(`shadow ${named(tokens.shadow, style.boxShadow)}`)
    if (style.position !== 'static') parts.push(style.position)
    const id = el.getAttribute('data-testid')
    const label = el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => '.' + c).join('') + (id ? `[data-testid=${id}]` : '')
    lines.push('  '.repeat(level) + label + '  ' + parts.join('; '))
    if (level < depth) for (const child of el.children) visit(child, level + 1)
  }
  visit(root, 0)
  const box = root.getBoundingClientRect()
  return { lines, box: { x: box.x, y: box.y, width: box.width, height: box.height }, base: getComputedStyle(document.documentElement).fontSize }
}

const browser = await loadPlaywright()[flags.browser ?? 'webkit'].launch()
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: (flags.size ?? 'desktop') !== 'desktop' })
  await context.addInitScript(({ theme, lang }) => {
    if (theme) localStorage.setItem('openbeads:theme', theme)
    if (lang) localStorage.setItem('openbeads:locale', lang)
  }, { theme: flags.theme, lang: flags.lang })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'load' })
  for (const step of dos) {
    const [verb, ...tail] = step.split(':')
    const arg = tail.join(':')
    if (verb === 'click') await page.click(arg)
    else if (verb === 'hover') await page.hover(arg)
    else if (verb === 'wait') await page.waitForTimeout(Number(arg))
    else throw new Error(`unknown --do ${step}`)
  }
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 6000 })
  } catch {
    const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-testid]')].filter((el) => el.getClientRects().length).map((el) => el.dataset.testid))])
    console.error(`nothing visible matches ${selector} at ${page.url()}\nvisible data-testid values: ${ids.slice(0, 60).join(', ') || 'none'}`)
    process.exitCode = 1
    await browser.close()
    process.exit()
  }
  await page.evaluate(() => document.fonts.ready)
  const found = await page.evaluate(describe, { selector, depth: Number(flags.depth ?? 2) })
  console.log(`${url}  ${width}×${height} at 2×, base font ${found.base}`)
  for (const line of found.lines.slice(0, 80)) console.log(line)
  if (found.lines.length > 80) console.log(`… ${found.lines.length - 80} more lines: narrow the selector or lower --depth`)
  if (flags.shot) {
    const clip = { x: Math.max(0, found.box.x - 16), y: Math.max(0, found.box.y - 16), width: Math.min(width, found.box.width + 32), height: Math.min(height, found.box.height + 32) }
    await page.screenshot({ path: flags.shot, clip, scale: 'css' })
    console.log(`shot ${flags.shot} (${Math.round(clip.width)}×${Math.round(clip.height)})`)
  }
} finally {
  await browser.close()
}
