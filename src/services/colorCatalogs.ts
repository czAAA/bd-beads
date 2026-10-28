import { parseColorCatalog, type ColorCatalog } from '../domain/colorCatalog'

// One lazy chunk per catalog (ADR 0072, ticket 536): a Project loads only the catalog its Bead points at. A file in the
// folder is found at build time and known by its name, so a new catalog is its file alone (ADR 0078). The files are
// made by the script in the docs repo.
const CATALOG_FILES = Object.fromEntries(
  Object.entries(import.meta.glob('../data/colorCatalogs/*.json', { import: 'default' })).map(([path, file]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.json'.length),
    file,
  ]),
)

const loaded = new Map<string, Promise<ColorCatalog>>()

/** The Color catalog with this id, fetched on first use and checked on load; rejects for an id with no file. */
export function loadColorCatalog(id: string): Promise<ColorCatalog> {
  const file = CATALOG_FILES[id]
  if (!file) return Promise.reject(new Error(`No color catalog ${id}`))
  let catalog = loaded.get(id)
  if (!catalog) {
    catalog = file().then((contents) => parseColorCatalog(contents, id))
    catalog.catch(() => loaded.delete(id))
    loaded.set(id, catalog)
  }
  return catalog
}
