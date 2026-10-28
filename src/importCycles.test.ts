import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

/** The import cycle guard (ticket 0620): no `.ts` module of the app reaches itself through static runtime imports, so a
 * split module stays split and none is half-initialised when the app loads. Type-only imports are erased and don't count. */

const SRC = import.meta.dirname

/** Every app module: the `.ts` files under `src/`, without tests and declarations. */
function appModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return appModules(path)
    return /\.ts$/.test(entry.name) && !/\.(test|d)\.ts$/.test(entry.name) ? [path] : []
  })
}

/** Whether an import or export statement brings in anything at run time: not `import type`, not only `type` names. */
function isRuntime(statement: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  if (ts.isExportDeclaration(statement)) {
    const names = statement.exportClause
    const onlyTypes = !!names && ts.isNamedExports(names) && names.elements.length > 0 && names.elements.every((name) => name.isTypeOnly)
    return !statement.isTypeOnly && !onlyTypes
  }
  const clause = statement.importClause
  if (!clause) return true
  if (clause.isTypeOnly) return false
  const names = clause.namedBindings
  if (clause.name || !names || ts.isNamespaceImport(names) || names.elements.length === 0) return true
  return names.elements.some((name) => !name.isTypeOnly)
}

/** The relative paths a module's source imports from at run time. */
function runtimeSpecifiers(file: string, text: string): string[] {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest).statements.flatMap((statement) => {
    const linked = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
    if (!linked || !statement.moduleSpecifier || !isRuntime(statement)) return []
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    return specifier.startsWith('.') ? [specifier] : []
  })
}

/** The app modules a module imports at run time. */
function runtimeImports(file: string, modules: Set<string>): string[] {
  return runtimeSpecifiers(file, readFileSync(file, 'utf8'))
    .map((specifier) => `${resolve(dirname(file), specifier)}.ts`)
    .filter((target) => modules.has(target))
}

/** The groups of modules that import each other round in a circle (Tarjan's strongly connected components). */
function cycles(graph: Map<string, string[]>): string[][] {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const found: string[][] = []
  const visit = (module: string) => {
    index.set(module, index.size)
    low.set(module, index.get(module)!)
    stack.push(module)
    for (const next of graph.get(module) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(module, Math.min(low.get(module)!, low.get(next)!))
      } else if (stack.includes(next)) {
        low.set(module, Math.min(low.get(module)!, index.get(next)!))
      }
    }
    if (low.get(module) === index.get(module)) {
      const group = stack.splice(stack.indexOf(module))
      if (group.length > 1 || graph.get(module)?.includes(module)) found.push(group.map((file) => relative(SRC, file)).sort())
    }
  }
  for (const module of graph.keys()) {
    if (!index.has(module)) visit(module)
  }
  return found
}

it('no app module imports itself back through others at run time', () => {
  const files = appModules(SRC)
  const modules = new Set(files)
  const graph = new Map(files.map((file) => [file, runtimeImports(file, modules)]))
  const advice = 'these modules import each other round in a circle: move what both need into a module of its own, or import a type with `import type`'
  expect(cycles(graph), advice).toEqual([])
})

it('sees a cycle when there is one', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((name) => `${SRC}/${name}.ts`) as [string, string, string, string]
  const graph = new Map([[a, [b]], [b, [c]], [c, [a]], [d, [a]]])
  expect(cycles(graph)).toEqual([['a.ts', 'b.ts', 'c.ts']])
})

it('counts only the imports that bring something in at run time', () => {
  const source = [
    "import { a } from './value'",
    "import { type b, c } from './mixed'",
    "import d from './default'",
    "import * as e from './namespace'",
    "import './effect'",
    "export { f } from './reexport'",
    "import type { G } from './typeOnly'",
    "import { type H } from './typeNames'",
    "export type { I } from './typeExport'",
    "export { type J } from './typeExportNames'",
    "import { k } from 'package'",
  ].join('\n')
  expect(runtimeSpecifiers('x.ts', source)).toEqual(['./value', './mixed', './default', './namespace', './effect', './reexport'])
})
