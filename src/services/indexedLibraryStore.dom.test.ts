import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from '../domain/createProject'
import { lastSaved } from '../domain/projectLibrary'
import type { Project } from '../domain/project'
import { withLayers } from '../testUtils/layerFields'
import { canvasOf } from '../domain/layerRecord'
import { encodeProject } from '../domain/projectEncoding'
import { BEAD_CATALOG } from '../domain/beads'
import { createBrowserLibraryStore, loadProjects, saveProjects } from './libraryStore'
import { LIBRARY_DATABASE, MOVED_FLAG, RECORD_FORMAT, removeOldLibraryOnceSafe } from './indexedLibraryStore'
import { CLOSING_NOTE_KEY } from './closingNote'
import libraryV1 from '../domain/fixtures/library-v1.json?raw'
import libraryV2 from '../domain/fixtures/library-v2.json?raw'
import libraryV2OverCap from '../domain/fixtures/library-v2-over-cap.json?raw'
import libraryV3 from '../domain/fixtures/library-v3.json?raw'
import libraryV4 from '../domain/fixtures/library-v4.json?raw'
import libraryV4BrickBlock from '../domain/fixtures/library-v4-brick-block.json?raw'
import recordFixture from '../domain/fixtures/library-record-v1.json'
import libraryV5 from '../domain/fixtures/library-v5-layers.json?raw'

const STORAGE_KEY = 'openbeads:patterns'
const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

function makeProject(name: string, updatedAt = 1_700_000_000_000): Project {
  const project = createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
  return withLayers(project, {
    id: `project-${name}`,
    name,
    updatedAt,
    createdAt: updatedAt,
  })
}

const byId = (projects: readonly Project[]) => [...projects].sort((a, b) => a.id.localeCompare(b.id))
const names = (projects: readonly { layers?: unknown; name?: string; id: string }[]) => projects.map((project) => project.id).sort()

/** A fresh tab on the device: its own store over the page's IndexedDB and localStorage, started. */
async function startTab() {
  const store = createBrowserLibraryStore()
  const answered = await store.start()
  return { store, answered }
}

/** Opens the library database directly, as a developer's tools would, for one piece of work. */
async function withDatabase<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DATABASE, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await work(db)
  } finally {
    db.close()
  }
}

interface RecordRow {
  id: string
  format: number
  stored: string
  stamp: string
  summary: unknown
}

const records = () =>
  withDatabase(
    (db) =>
      new Promise<RecordRow[]>((resolve, reject) => {
        const request = db.transaction('projects').objectStore('projects').getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )

/** Writes a row into one of the database's stores. */
const putRow = (storeName: 'projects' | 'meta', row: object) =>
  withDatabase(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite')
        transaction.objectStore(storeName).put(row)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }),
  )

const putRecord = (record: object) => putRow('projects', record)

beforeEach(() => {
  localStorage.clear()
  globalThis.indexedDB = new IDBFactory()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// The `page` project's files share a worker's globals (`isolate: false`): a file run after this one must find no
// IndexedDB, as jsdom has none, or its library is decided as the IndexedDB form.
afterAll(() => {
  Reflect.deleteProperty(globalThis, 'indexedDB')
})

describe('the library in IndexedDB', () => {
  it('starts empty on a new device, sets the moved flag and keeps nothing in localStorage', async () => {
    const store = createBrowserLibraryStore()

    expect(await store.count()).toBe(0)
    expect(await store.start()).toBe('ready')

    expect(localStorage.getItem(MOVED_FLAG)).toBe('1')
    expect(store.open(() => false)).toEqual({ projects: [], sealed: [] })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('stores each Project as a record, counts them and reads them back at the next start', async () => {
    const { store } = await startTab()
    const [fox, owl] = [makeProject('Fox'), makeProject('Owl')]

    await store.save(
      [
        { project: fox, knownStored: false },
        { project: owl, knownStored: false },
      ],
      [],
    )

    const rows = await records()
    expect(names(rows)).toEqual(['project-Fox', 'project-Owl'])
    expect(rows[0]).toMatchObject({
      format: RECORD_FORMAT,
      summary: { name: 'Fox' },
    })
    expect(typeof rows[0]!.stamp).toBe('string')
    expect(JSON.parse(rows[0]!.stored)).toMatchObject({ id: 'project-Fox' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    const next = createBrowserLibraryStore()
    expect(await next.count()).toBe(2)
    await next.start()
    const opened = next.open(() => false)
    expect(names(opened.projects)).toEqual(['project-Fox', 'project-Owl'])
    expect(canvasOf(opened.projects.find((project) => project.id === 'project-Fox')!).name).toBe('Fox')
  })

  it('writes only the Projects that changed, deletes the removed ones and gives every write a new stamp', async () => {
    const { store } = await startTab()
    const [fox, owl] = [makeProject('Fox'), makeProject('Owl')]
    await store.save(
      [
        { project: fox, knownStored: false },
        { project: owl, knownStored: false },
      ],
      [],
    )
    const before = new Map((await records()).map((row) => [row.id, row.stamp]))

    const foxAgain = { ...fox, updatedAt: fox.updatedAt + 1 }
    await store.save([{ project: foxAgain, knownStored: true }], ['project-Owl'])

    const after = await records()
    expect(names(after)).toEqual(['project-Fox'])
    expect(after[0]!.stamp).not.toBe(before.get('project-Fox'))
  })

  it('rereads by stamp: what another tab wrote or removed, and nothing for what this tab holds', async () => {
    const first = await startTab()
    const fox = makeProject('Fox')
    await first.store.save([{ project: fox, knownStored: false }], [])
    const second = await startTab()
    const held = second.store.open(() => false).projects
    expect(await second.store.reread(held, () => false)).toEqual({
      changed: [],
      gone: [],
    })

    const owl = makeProject('Owl')
    await first.store.save(
      [
        { project: owl, knownStored: false },
        {
          project: { ...fox, updatedAt: fox.updatedAt + 5 },
          knownStored: true,
        },
      ],
      [],
    )
    const heard = await second.store.reread(held, () => false)
    expect(names(heard.changed)).toEqual(['project-Fox', 'project-Owl'])
    expect(heard.gone).toEqual([])

    await first.store.save([], ['project-Fox'])
    expect((await second.store.reread(held, () => false)).gone).toEqual(['project-Fox'])
    expect(names((await second.store.reread(held, () => false, ['project-Owl'])).changed)).toEqual(['project-Owl'])
  })

  it('does not write back a Project the library knew as stored whose record is gone, and says so', async () => {
    const { store } = await startTab()
    const fox = makeProject('Fox')
    await store.save([{ project: fox, knownStored: false }], [])
    await store.save([], ['project-Fox'])

    const result = await store.save(
      [
        {
          project: { ...fox, updatedAt: fox.updatedAt + 1 },
          knownStored: true,
        },
      ],
      [],
    )

    expect(result.dropped).toEqual(['project-Fox'])
    expect(await records()).toEqual([])
  })

  it('answers a refused write as a rejection', async () => {
    const { store } = await startTab()
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await expect(store.save([{ project: makeProject('Fox'), knownStored: false }], [])).rejects.toBeDefined()
  })

  it('leaves a record of a format it does not know alone: not listed, not counted, not written, not deleted', async () => {
    const { store } = await startTab()
    await store.save([{ project: makeProject('Fox'), knownStored: false }], [])
    await putRecord({
      id: 'project-Newer',
      format: 2,
      stored: '{"future":true}',
      stamp: 'x',
      summary: null,
    })

    const next = createBrowserLibraryStore()
    expect(await next.count()).toBe(1)
    await next.start()
    expect(names(next.open(() => false).projects)).toEqual(['project-Fox'])
    await next.save(
      [
        {
          project: { ...makeProject('Newer'), id: 'project-Newer' },
          knownStored: false,
        },
      ],
      [],
    )
    await next.save([], ['project-Newer'])

    const rows = await records()
    expect(rows.find((row) => row.id === 'project-Newer')).toMatchObject({
      format: 2,
      stored: '{"future":true}',
      stamp: 'x',
    })
  })

  it('opens a record of format 1 from the stored-data fixtures as the Project it holds', async () => {
    await startTab()
    await putRecord(recordFixture)
    localStorage.setItem(STORAGE_KEY, libraryV5)
    const expected = loadProjects().find((project) => project.id === recordFixture.id)
    localStorage.removeItem(STORAGE_KEY)

    const next = createBrowserLibraryStore()
    await next.start()

    expect(next.open(() => false).projects).toEqual([expected])
  })

  it('closes its connection when the browser asks, so a later version is never blocked, and opens it again when next used', async () => {
    const { store } = await startTab()
    await store.save([{ project: makeProject('Fox'), knownStored: false }], [])
    const removed = new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(LIBRARY_DATABASE)
      request.onsuccess = () => resolve()
      request.onblocked = () => reject(new Error('blocked by an open tab'))
      request.onerror = () => reject(request.error)
    })
    await expect(removed).resolves.toBeUndefined()

    await expect(store.save([{ project: makeProject('Owl'), knownStored: false }], [])).resolves.toEqual({ dropped: [] })
    expect(names(await records())).toEqual(['project-Owl'])
  })
})

describe('the copy of the old library', () => {
  const FIXTURES = [
    ['version 1', libraryV1],
    ['version 2', libraryV2],
    ['an over-cap version 2', libraryV2OverCap],
    ['version 3', libraryV3],
    ['version 4', libraryV4],
    ['version 4 with a Brick block', libraryV4BrickBlock],
    ['version 5', libraryV5],
  ] as const

  it.each(FIXTURES)('moves a %s library across as the Projects it held, the old key as it was', async (_label, fixture) => {
    localStorage.setItem(STORAGE_KEY, fixture)
    const expected = loadProjects()
    expect(expected.length).toBeGreaterThan(0)
    const set = vi.spyOn(Storage.prototype, 'setItem')
    const remove = vi.spyOn(Storage.prototype, 'removeItem')

    const { store, answered } = await startTab()

    expect(answered).toBe('ready')
    expect(localStorage.getItem(MOVED_FLAG)).toBe('1')
    expect(byId(store.open(() => false).projects)).toEqual(byId(expected))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(fixture)
    expect(set.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([])
    expect(remove.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([])
  })

  it('moves a library the current version wrote, and a Project too large to decode stays sealed', async () => {
    const [fox, owl] = [makeProject('Fox'), makeProject('Owl')]
    saveProjects([fox, owl])
    const written = localStorage.getItem(STORAGE_KEY)

    const { store } = await startTab()

    expect(names(store.open(() => false).projects)).toEqual(['project-Fox', 'project-Owl'])
    const sealed = store.open((summary) => summary.id === 'project-Owl')
    expect(names(sealed.sealed)).toEqual(['project-Owl'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(written)
  })

  it('copies the deprecated bd-beads: key forward as the readers always did', async () => {
    localStorage.setItem('bd-beads:patterns', libraryV5)
    const expected = (() => {
      localStorage.setItem(STORAGE_KEY, libraryV5)
      const projects = loadProjects()
      localStorage.removeItem(STORAGE_KEY)
      return projects
    })()

    const { store } = await startTab()

    expect(byId(store.open(() => false).projects)).toEqual(byId(expected))
  })

  it('sets the flag at once for an empty or missing old library', async () => {
    localStorage.setItem(STORAGE_KEY, '{"version":6,"patterns":[]}')

    const { store } = await startTab()

    expect(localStorage.getItem(MOVED_FLAG)).toBe('1')
    expect(store.open(() => false).projects).toEqual([])
    expect(await records()).toEqual([])
  })

  it('sets the flag and starts empty for an old library this build cannot read, leaving the value as it is', async () => {
    const unreadable = '{"version":99,"patterns":[{"from":"the future"}]}'
    localStorage.setItem(STORAGE_KEY, unreadable)

    const { store } = await startTab()

    expect(localStorage.getItem(MOVED_FLAG)).toBe('1')
    expect(store.open(() => false).projects).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(unreadable)
    expect(localStorage.getItem('openbeads:patterns:unreadable')).toBeNull()
  })

  it('sets no flag when the copy fails, runs this start on localStorage, and tries again at the next start', async () => {
    localStorage.setItem(STORAGE_KEY, libraryV5)
    const expected = loadProjects()
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('refused', 'QuotaExceededError')
    })

    const first = await startTab()

    expect(first.answered).toBe('ready')
    expect(localStorage.getItem(MOVED_FLAG)).toBeNull()
    expect(byId(first.store.open(() => false).projects)).toEqual(byId(expected))
    put.mockRestore()

    const second = await startTab()

    expect(localStorage.getItem(MOVED_FLAG)).toBe('1')
    expect(byId(second.store.open(() => false).projects)).toEqual(byId(expected))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(libraryV5)
  })
})

describe('the old library taken in', () => {
  const oldKeyHolds = (...projects: Project[]) => saveProjects(projects)
  const fox = (updatedAt: number) => makeProject('Fox', updatedAt)

  it('takes in a Project new there, at the next start, leaving the old key as it was', async () => {
    oldKeyHolds(fox(1_700_000_000_000))
    await startTab()
    const owl = makeProject('Owl')
    oldKeyHolds(fox(1_700_000_000_000), owl)
    const before = localStorage.getItem(STORAGE_KEY)

    const { store } = await startTab()

    expect(names(store.open(() => false).projects)).toEqual(['project-Fox', 'project-Owl'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('takes in a Project changed there when its last save is newer than the record', async () => {
    oldKeyHolds(fox(1_700_000_000_000))
    await startTab()
    oldKeyHolds(fox(1_800_000_000_000))
    const { store } = await startTab()

    expect(lastSaved(store.open(() => false).projects[0]!)).toBe(1_800_000_000_000)
  })

  it('leaves a record newer than the old library alone', async () => {
    oldKeyHolds(fox(1_700_000_000_000))
    const first = await startTab()
    await first.store.save([{ project: fox(1_900_000_000_000), knownStored: true }], [])
    oldKeyHolds(fox(1_800_000_000_000))

    const { store } = await startTab()

    expect(lastSaved(store.open(() => false).projects[0]!)).toBe(1_900_000_000_000)
  })

  it('never deletes a Project missing from the old library, and does not bring back one it still holds unchanged', async () => {
    oldKeyHolds(fox(1_700_000_000_000), makeProject('Owl'))
    const first = await startTab()
    await first.store.save([], ['project-Owl'])
    expect(names((await startTab()).store.open(() => false).projects)).toEqual(['project-Fox'])
    oldKeyHolds(fox(1_700_000_000_000))
    expect(names((await startTab()).store.open(() => false).projects)).toEqual(['project-Fox'])
  })

  it('changes nothing for an unreadable or missing old value', async () => {
    oldKeyHolds(fox(1_700_000_000_000))
    await startTab()
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(names((await startTab()).store.open(() => false).projects)).toEqual(['project-Fox'])
    localStorage.removeItem(STORAGE_KEY)
    expect(names((await startTab()).store.open(() => false).projects)).toEqual(['project-Fox'])
  })

  it('does not parse an old library whose digest is the remembered one', async () => {
    oldKeyHolds(fox(1_700_000_000_000))
    await startTab()
    const raw = localStorage.getItem(STORAGE_KEY)!
    const parse = vi.spyOn(JSON, 'parse')

    await startTab()

    expect(parse.mock.calls.filter(([text]) => text === raw)).toEqual([])
  })

  it('takes in the old key when the storage event names it, and tells the library which Projects', async () => {
    oldKeyHolds(fox(1_700_000_000_000))
    const { store } = await startTab()
    const heard = vi.fn()
    const stop = store.onOutsideChange(heard)
    const heardByOther = vi.fn()
    const stopOther = (await startTab()).store.onOutsideChange(heardByOther)
    oldKeyHolds(fox(1_700_000_000_000), makeProject('Owl'))

    window.dispatchEvent(new StorageEvent('storage', { key: 'openbeads:other' }))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    await vi.waitFor(() => expect(heard).toHaveBeenCalledWith(['project-Owl']))

    expect(heard).toHaveBeenCalledTimes(1)
    expect(heardByOther).toHaveBeenCalledWith(['project-Owl'])
    expect(names(await records())).toEqual(['project-Fox', 'project-Owl'])
    stop()
    stopOther()
  })
})

describe('the old library removed (ticket 1023)', () => {
  const OLD_NAME_KEY = 'bd-beads:patterns'
  const DAY = 24 * 60 * 60 * 1000
  const oldKeyHolds = (...projects: Project[]) => saveProjects(projects)
  const fox = (updatedAt = 1_700_000_000_000) => makeProject('Fox', updatedAt)

  /** What the store remembers of the old library. */
  const remembered = () =>
    withDatabase(
      (db) =>
        new Promise<{ since?: number; starts?: number } | undefined>((resolve, reject) => {
          const request = db.transaction('meta').objectStore('meta').get('old-library')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        }),
    )

  /** Starts a tab and waits until that start was counted: the count is not part of the start. */
  async function startCounted(starts = 1) {
    const tab = await startTab()
    await vi.waitFor(async () => expect((await remembered())?.starts).toBe(starts))
    return tab
  }

  /** Counts `count` more starts at `now`, and answers whether each deleted the old library. */
  async function startsAt(now: number, count: number): Promise<boolean[]> {
    const deleted: boolean[] = []
    for (let index = 0; index < count; index += 1) deleted.push(await withDatabase((db) => removeOldLibraryOnceSafe(db, now)))
    return deleted
  }

  /** Long after the move: the 14 days have passed, so only the starts and the check decide. */
  const late = () => Date.now() + 15 * DAY

  it('keeps the old library for 14 days, however many starts', async () => {
    oldKeyHolds(fox())
    const before = localStorage.getItem(STORAGE_KEY)
    await startCounted()
    const moved = (await remembered())!.since!

    expect(await startsAt(moved + 14 * DAY - 1, 20)).not.toContain(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(await startsAt(moved + 14 * DAY, 1)).toEqual([true])
  })

  it('keeps it for 10 starts, however many days, then deletes it, and the Projects stay', async () => {
    oldKeyHolds(fox(), makeProject('Owl'))
    const before = localStorage.getItem(STORAGE_KEY)
    await startCounted()

    expect(await startsAt(Date.now() + 100 * DAY, 8)).not.toContain(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(await startsAt(Date.now() + 100 * DAY, 1)).toEqual([true])

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(MOVED_FLAG)).toBe('1')
    expect(names((await startTab()).store.open(() => false).projects)).toEqual(['project-Fox', 'project-Owl'])
  })

  it('is deleted by the start of a tab, once the library opened from IndexedDB', async () => {
    oldKeyHolds(fox())
    await startCounted()
    vi.useFakeTimers({ toFake: ['Date'], now: late() })

    for (let starts = 2; starts <= 9; starts += 1) await startCounted(starts)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    await startTab()

    await vi.waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull())
  })

  it('counts a device that moved before from its first start with this build', async () => {
    oldKeyHolds(fox())
    await startCounted()
    const { since: _since, starts: _starts, ...earlier } = (await remembered())!
    await putRow('meta', earlier)
    const first = Date.now() + 100 * DAY

    expect(await startsAt(first, 12)).not.toContain(true)
    expect((await remembered())!.since).toBe(first)
    expect(await startsAt(first + 14 * DAY, 1)).toEqual([true])
  })

  it('does not wait for a Project removed after the move', async () => {
    oldKeyHolds(fox(), makeProject('Owl'))
    const { store } = await startCounted()
    await store.save([], ['project-Owl'])

    expect(await startsAt(late(), 9)).toContain(true)
    expect(names(await records())).toEqual(['project-Fox'])
  })

  it.each([
    ['an older save', (record: RecordRow) => ({ ...record, summary: { ...(record.summary as object), updatedAt: 1_700_000_000_000 } })],
    ['a format this build does not know', (record: RecordRow) => ({ ...record, format: RECORD_FORMAT + 1 })],
    ['no summary', (record: RecordRow) => ({ ...record, summary: null })],
  ])('keeps an old library whose Project has a record with %s', async (_label, altered) => {
    oldKeyHolds(fox(1_800_000_000_000))
    await startCounted()
    const [record] = await records()
    await putRecord(altered(record!))

    expect(await startsAt(late(), 12)).not.toContain(true)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('keeps an old library this build cannot read', async () => {
    oldKeyHolds(fox())
    await startCounted()
    localStorage.setItem(STORAGE_KEY, '{not json')
    await startTab()

    expect(await startsAt(late(), 12)).not.toContain(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not json')
  })

  it('keeps an old library holding a Project of a Technique this build does not know', async () => {
    oldKeyHolds(fox(), makeProject('Owl'))
    const unknownTechnique = localStorage.getItem(STORAGE_KEY)!.replace('"technique":"loom"', '"technique":"not-a-technique"')
    localStorage.setItem(STORAGE_KEY, unknownTechnique)
    expect(names((await startCounted()).store.open(() => false).projects)).toEqual(['project-Owl'])

    expect(await startsAt(late(), 12)).not.toContain(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(unknownTechnique)
  })

  it('starts the wait again when an older build writes the old library, and keeps a value not yet taken in', async () => {
    oldKeyHolds(fox())
    await startCounted()
    expect(await startsAt(late(), 8)).not.toContain(true)

    // Written, not yet taken in: the tenth start keeps it.
    oldKeyHolds(fox(), makeProject('Owl'))
    expect(await startsAt(late(), 1)).toEqual([false])
    await startCounted()
    expect(await startsAt(late(), 1)).toEqual([false])

    expect(names(await records())).toEqual(['project-Fox', 'project-Owl'])
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('keeps a value an older build wrote while the records were being checked', async () => {
    oldKeyHolds(fox())
    await startCounted()
    await startsAt(late(), 8)
    const get = IDBObjectStore.prototype.get
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
      if (this.name === 'projects') oldKeyHolds(fox(), makeProject('Owl'))
      return get.call(this, key)
    })

    expect(await startsAt(late(), 1)).toEqual([false])

    expect(names(loadProjects())).toEqual(['project-Fox', 'project-Owl'])
  })

  it('deletes the old-name copy with it', async () => {
    localStorage.setItem(OLD_NAME_KEY, libraryV5)
    await startCounted()

    expect(await startsAt(late(), 9)).toContain(true)

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(OLD_NAME_KEY)).toBeNull()
  })

  it('keeps an old-name copy holding a newer save, and never copies it forward again', async () => {
    oldKeyHolds(fox(1_900_000_000_000))
    localStorage.setItem(OLD_NAME_KEY, localStorage.getItem(STORAGE_KEY)!)
    oldKeyHolds(fox(1_700_000_000_000))
    const oldName = localStorage.getItem(OLD_NAME_KEY)
    await startCounted()

    expect(await startsAt(late(), 9)).toContain(true)

    expect(localStorage.getItem(OLD_NAME_KEY)).toBe(oldName)
    const { store } = await startTab()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(lastSaved(store.open(() => false).projects[0]!)).toBe(1_700_000_000_000)
  })
})

describe('tabs of the same build', () => {
  it('tells the other tabs which Projects a save wrote and removed, and not the tab that saved', async () => {
    const first = await startTab()
    const second = await startTab()
    const heardThere = vi.fn()
    const heardHere = vi.fn()
    const stop = second.store.onOutsideChange(heardThere)
    const stopHere = first.store.onOutsideChange(heardHere)

    await first.store.save([{ project: makeProject('Fox'), knownStored: false }], ['project-Owl'])
    await vi.waitFor(() => expect(heardThere).toHaveBeenCalledWith(['project-Fox', 'project-Owl']))

    expect(heardHere).not.toHaveBeenCalled()
    stop()
    stopHere()
  })

  it('stops hearing once told to', async () => {
    const first = await startTab()
    const second = await startTab()
    const heard = vi.fn()
    second.store.onOutsideChange(heard)()

    await first.store.save([{ project: makeProject('Fox'), knownStored: false }], [])
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(heard).not.toHaveBeenCalled()
  })

  it('asks for a reread of everything when the tab becomes visible, and not when it hides', async () => {
    const { store } = await startTab()
    const heard = vi.fn()
    const stop = store.onOutsideChange(heard)
    const state = vi.spyOn(document, 'visibilityState', 'get')

    state.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(heard).not.toHaveBeenCalled()
    state.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(heard).toHaveBeenCalledWith(undefined)
    stop()
  })
})

describe('a device that would not open or never moved', () => {
  it('keeps the library in localStorage where the browser has no IndexedDB, as before', async () => {
    saveProjects([makeProject('Fox')])
    const stored = localStorage.getItem(STORAGE_KEY)
    vi.stubGlobal('indexedDB', undefined)

    const { store, answered } = await startTab()

    expect(answered).toBe('ready')
    expect(await store.count()).toBe(1)
    expect(names(store.open(() => false).projects)).toEqual(['project-Fox'])
    await store.save([{ project: makeProject('Owl'), knownStored: false }], [])
    expect(names(loadProjects())).toEqual(['project-Fox', 'project-Owl'])
    expect(localStorage.getItem(MOVED_FLAG)).toBeNull()
    expect(stored).not.toBeNull()
    vi.unstubAllGlobals()
  })

  it('keeps the library in localStorage where the browser refuses to open the database', async () => {
    saveProjects([makeProject('Fox')])
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('refused', 'SecurityError')
    })

    const { store, answered } = await startTab()

    expect(answered).toBe('ready')
    expect(names(store.open(() => false).projects)).toEqual(['project-Fox'])
    expect(localStorage.getItem(MOVED_FLAG)).toBeNull()
  })

  it('answers unopened on a moved device whose database fails, after one more try, and never opens the old copy', async () => {
    saveProjects([makeProject('Old')])
    localStorage.setItem(MOVED_FLAG, '1')
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('refused', 'UnknownError')
    })
    const reads = vi.spyOn(Storage.prototype, 'getItem')
    const writes = vi.spyOn(Storage.prototype, 'setItem')
    const store = createBrowserLibraryStore()

    expect(await store.count()).toBe('unopened')
    expect(await store.start()).toBe('unopened')

    expect(open).toHaveBeenCalledTimes(2)
    expect(store.open(() => false)).toEqual({ projects: [], sealed: [] })
    await expect(store.save([{ project: makeProject('New'), knownStored: false }], [])).rejects.toBeDefined()
    expect(reads.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([])
    expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([])
  })

  it('answers unopened when the database does not answer, four seconds in all', async () => {
    localStorage.setItem(MOVED_FLAG, '1')
    vi.useFakeTimers()
    const open = vi.spyOn(indexedDB, 'open').mockImplementation(() => ({}) as IDBOpenDBRequest)
    const store = createBrowserLibraryStore()
    let answer: unknown
    void store.count().then((count) => (answer = count))

    await vi.advanceTimersByTimeAsync(3_900)
    expect(answer).toBeUndefined()
    await vi.advanceTimersByTimeAsync(200)

    expect(answer).toBe('unopened')
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('answers unopened on a moved device whose browser has no IndexedDB', async () => {
    localStorage.setItem(MOVED_FLAG, '1')
    vi.stubGlobal('indexedDB', undefined)

    expect(await createBrowserLibraryStore().count()).toBe('unopened')
    vi.unstubAllGlobals()
  })
})

describe('the closing note', () => {
  const noteOf = () =>
    JSON.parse(localStorage.getItem(CLOSING_NOTE_KEY) ?? 'null') as {
      projects: Record<string, { stored: string; at: number }>
      removed: string[]
    } | null

  it('holds each write under way when the page hides, and drops it when the write lands', async () => {
    const { store } = await startTab()
    const fox = makeProject('Fox')

    const landing = store.save([{ project: fox, knownStored: false }], [])
    store.noteClosing()

    expect(Object.keys(noteOf()!.projects)).toEqual(['project-Fox'])
    expect(noteOf()!.projects['project-Fox']!.at).toBe(lastSaved(fox))
    expect(JSON.parse(noteOf()!.projects['project-Fox']!.stored)).toMatchObject({ id: 'project-Fox' })
    await landing
    expect(localStorage.getItem(CLOSING_NOTE_KEY)).toBeNull()
  })

  it('writes nothing when no write is under way', async () => {
    const { store } = await startTab()
    await store.save([{ project: makeProject('Fox'), knownStored: false }], [])

    store.noteClosing()

    expect(localStorage.getItem(CLOSING_NOTE_KEY)).toBeNull()
  })

  it('merges two tabs into the one note, and a tab that lands takes only its own entries out', async () => {
    const [one, other] = [await startTab(), await startTab()]
    const landingOne = one.store.save([{ project: makeProject('Fox'), knownStored: false }], [])
    one.store.noteClosing()
    const landingOther = other.store.save([{ project: makeProject('Owl'), knownStored: false }], [])
    other.store.noteClosing()
    expect(Object.keys(noteOf()!.projects).sort()).toEqual(['project-Fox', 'project-Owl'])

    await landingOne
    expect(Object.keys(noteOf()!.projects)).toEqual(['project-Owl'])
    await landingOther
    expect(localStorage.getItem(CLOSING_NOTE_KEY)).toBeNull()
  })

  it("notes a removal, and a removal wins over another tab's write of the same Project", async () => {
    const { store } = await startTab()
    const fox = makeProject('Fox')
    await store.save([{ project: fox, knownStored: false }], [])
    const other = await startTab()

    const removing = store.save([], ['project-Fox'])
    store.noteClosing()
    const writing = other.store.save(
      [
        {
          project: { ...fox, updatedAt: fox.updatedAt + 1 },
          knownStored: true,
        },
      ],
      [],
    )
    other.store.noteClosing()

    expect(noteOf()).toEqual({ projects: {}, removed: ['project-Fox'] })
    await Promise.all([removing, writing])
  })

  it('leaves a Project too large for the note to the write already started, and still notes the others', async () => {
    const { store } = await startTab()
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === CLOSING_NOTE_KEY && value.includes('project-Big')) throw new DOMException('too large', 'QuotaExceededError')
      real.call(this, key, value)
    })

    const landing = store.save(
      [
        { project: makeProject('Big'), knownStored: false },
        { project: makeProject('Small'), knownStored: false },
      ],
      [],
    )
    store.noteClosing()

    expect(Object.keys(noteOf()!.projects)).toEqual(['project-Small'])
    await landing
    expect(names(await records())).toEqual(['project-Big', 'project-Small'])
  })

  it('is written into the records at the next start, then cleared, before the library loads', async () => {
    const { store } = await startTab()
    const fox = makeProject('Fox', 1_700_000_000_000)
    const owl = makeProject('Owl')
    await store.save([{ project: owl, knownStored: false }], [])
    const stored = JSON.stringify(encodeProject(fox))
    localStorage.setItem(
      CLOSING_NOTE_KEY,
      JSON.stringify({
        projects: { 'project-Fox': { stored, at: lastSaved(fox) } },
        removed: ['project-Owl'],
      }),
    )

    const next = await startTab()

    expect(names(next.store.open(() => false).projects)).toEqual(['project-Fox'])
    expect(names(await records())).toEqual(['project-Fox'])
    expect(localStorage.getItem(CLOSING_NOTE_KEY)).toBeNull()
  })

  it('skips an entry whose record is newer, and still clears the note', async () => {
    const { store } = await startTab()
    const newer = makeProject('Fox', 1_800_000_000_000)
    await store.save([{ project: newer, knownStored: false }], [])
    const older = makeProject('Fox', 1_700_000_000_000)
    const stored = JSON.stringify(encodeProject(withLayers(older, { name: 'Older' })))
    localStorage.setItem(
      CLOSING_NOTE_KEY,
      JSON.stringify({
        projects: { 'project-Fox': { stored, at: lastSaved(older) } },
        removed: [],
      }),
    )

    const next = await startTab()

    expect(canvasOf(next.store.open(() => false).projects[0]!).name).toBe('Fox')
    expect(localStorage.getItem(CLOSING_NOTE_KEY)).toBeNull()
  })
})
