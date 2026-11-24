#!/usr/bin/env node
// Scaffolds one design topic (bd-ux-design skill): canvas.html, shared.css, options/<id>.html and an empty comments.json.
//   node init.mjs <designDir> "<Title>" a b c     never overwrites a file that is already there
//   node init.mjs <designDir> "<Title>" 1a 1b 2a 2b 3   several questions: a <section data-group> per number
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
const section = (id, pad) => `${pad}<section
${pad}  data-option="${id}"
${pad}  data-name="${id.toUpperCase()} · Name"
${pad}  data-idea="The idea in one line."
${pad}  data-tradeoff="What it costs."
${pad}  data-src="options/${id}.html"
${pad}  data-states="default open long"
${pad}></section>`
// Ids like 1a 1b 2a 2b 3 are several questions: one <section data-group> per number, its options in one row.
const questions = ids.every((id) => /^\d+[a-z]*$/.test(id)) ? [...new Set(ids.map((id) => id.match(/^\d+/)[0]))] : []
const options = questions.length > 1
  ? questions.map((n) => `      <section data-group="${n}" data-title="${n} · The question's short name" data-question="What this question decides, in one line">
${ids.filter((id) => id.match(/^\d+/)[0] === n).map((id) => section(id, '        ')).join('\n')}
      </section>`)
  : ids.map((id) => section(id, '      '))
write('canvas.html', template('canvas-template.html').replaceAll('__TITLE__', title).replace('__OPTIONS__', options.join('\n')))
write('shared.css', template('shared-template.css'))
write('comments.json', '[]\n')
for (const id of ids) write(`options/${id}.html`, template('option-template.html').replaceAll('__TITLE__', title).replaceAll('__ID__', id.toUpperCase()))
