import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

/** The import cycle guard (ticket 0620): no module of the app reaches itself through runtime imports, so a split
 * module stays split and none is half-initialised when the app loads. Type-only imports are erased and don't count. */

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
    return !statement.isTypeOnly && !(names && ts.isNamedExports(names) && names.elements.length > 0 && names.elements.every((name) => name.isTypeOnly))
  }
  const clause = statement.importClause
  if (!clause) return true
  if (clause.isTypeOnly) return false
  const names = clause.namedBindings
  return !!clause.name || !names || ts.isNamespaceImport(names) || names.elements.length === 0 || names.elements.some((name) => !name.isTypeOnly)
}

/** The app modules a module imports at run time. */
function runtimeImports(file: string, modules: Set<string>): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
  return source.statements.flatMap((statement) => {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !isRuntime(statement)) return []
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const target = `${resolve(dirname(file), specifier)}.ts`
    return specifier.startsWith('.') && modules.has(target) ? [target] : []
  })
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
  expect(cycles(graph), 'these modules import each other round in a circle: move what both need into a module of its own, or import a type with `import type`').toEqual([])
})

it('sees a cycle when there is one', () => {
  const graph = new Map([[`${SRC}/a.ts`, [`${SRC}/b.ts`]], [`${SRC}/b.ts`, [`${SRC}/c.ts`]], [`${SRC}/c.ts`, [`${SRC}/a.ts`]], [`${SRC}/d.ts`, [`${SRC}/a.ts`]]])
  expect(cycles(graph)).toEqual([['a.ts', 'b.ts', 'c.ts']])
})
