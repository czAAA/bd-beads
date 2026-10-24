import { parseColorCatalog, type ColorCatalog } from '../domain/colorCatalog'

// One lazy chunk per catalog (ADR 0072, ticket 536): a Project loads only the catalog its Bead points at. The files
// are made by the script in the docs repo.
const CATALOG_FILES: Readonly<Record<string, () => Promise<{ default: unknown }>>> = {
  'miyuki-delica': () => import('../data/colorCatalogs/miyuki-delica.json'),
  'miyuki-round': () => import('../data/colorCatalogs/miyuki-round.json'),
}

const loaded = new Map<string, Promise<ColorCatalog>>()

/** The Color catalog with this id, fetched on first use and checked on load; rejects for an id with no file. */
export function loadColorCatalog(id: string): Promise<ColorCatalog> {
  const file = CATALOG_FILES[id]
  if (!file) return Promise.reject(new Error(`No color catalog ${id}`))
  let catalog = loaded.get(id)
  if (!catalog) {
    catalog = file().then((module) => parseColorCatalog(module.default, id))
    catalog.catch(() => loaded.delete(id))
    loaded.set(id, catalog)
  }
  return catalog
}
