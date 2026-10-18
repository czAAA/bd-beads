/** A D1 database's size in bytes from the metadata every query returns (`size_after`); the probe reads and writes no
 * rows (spec 385, "Blob storage limit"). Throws when the database can't be read, which is how health tells a dead
 * one. */
export async function databaseSize(db: D1Database): Promise<number> {
  const { meta } = await db.prepare('SELECT 1').run()
  const size = (meta as { size_after?: unknown }).size_after
  if (typeof size !== 'number') throw new Error('D1 returned no size_after with its query')
  return size
}
