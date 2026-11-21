#!/usr/bin/env node
// Scaffolds one design topic (bd-ux-design skill): canvas.html, shared.css, options/<id>.html and an empty comments.json.
//   node init.mjs <designDir> "<Title>" a b c     never overwrites a file that is already there
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [dirArg, title, ...ids] = process.argv.slice(2)
if (!dirArg || !title || !ids.length) {
  console.error('usage: node init.mjs <designDir> "<Title>" <optionId> [optionId…]')
  process.exit(2)
}
const dir = path.resolve(dirArg)
const template = (name) => fs.readFileSync(path.join(HERE, name), 'utf8')
const write = (file, text) => {
  const target = path.join(dir, file)
  if (fs.existsSync(target)) return console.log(`kept    ${file}`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, text)
  console.log(`created ${file}`)
}
const sections = ids.map((id) => `      <section
        data-option="${id}"
        data-name="${id.toUpperCase()} · Name"
        data-idea="The idea in one line."
        data-tradeoff="What it costs."
        data-src="options/${id}.html"
        data-states="default open long"
      ></section>`)
write('canvas.html', template('canvas-template.html').replaceAll('__TITLE__', title).replace('__OPTIONS__', sections.join('\n')))
write('shared.css', template('shared-template.css'))
write('comments.json', '[]\n')
for (const id of ids) write(`options/${id}.html`, template('option-template.html').replaceAll('__TITLE__', title).replaceAll('__ID__', id.toUpperCase()))
