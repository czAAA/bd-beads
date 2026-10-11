/**
 * A D1 database's size in bytes, from the metadata D1 returns with every query (`size_after`). The probe reads no
 * rows and writes none, so measuring costs nothing against the daily limits (spec 385, "Blob storage limit"). It
 * throws when the database can't be read, which is also how health tells a dead database.
 */
export async function databaseSize(db: D1Database): Promise<number> {
  const { meta } = await db.prepare('SELECT 1').run()
  const size = (meta as { size_after?: unknown }).size_after
  if (typeof size !== 'number') throw new Error('D1 returned no size_after with its query')
  return size
}
