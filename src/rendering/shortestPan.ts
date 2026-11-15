import type { Region, Scroll } from './surfaceView'

/** How far one side of a block has to move along one axis to lie inside the room's: none when it already does. A block
 * longer than the room moves only until it fills the room, its near edge at the room's. */
function shiftAlong(start: number, length: number, roomStart: number, roomLength: number): number {
  const end = start + length
  const roomEnd = roomStart + roomLength
  if (length <= roomLength) {
    if (start < roomStart) return roomStart - start
    if (end > roomEnd) return roomEnd - end
    return 0
  }
  if (start > roomStart) return roomStart - start
  if (end < roomEnd) return roomEnd - end
  return 0
}

/** The shortest move on screen that brings a block (`region`, on screen) inside `room`, the part of the screen the
 * drawing is seen in (ticket 0934): nothing for a block already in it. A block too big for the room is moved only as
 * far as it takes to fill it: a row wider than the screen comes down into view and slides along only to close a gap. */
export function shortestPan(region: Region, room: Region): Scroll {
  // `+ 0` turns a -0 into 0, so "no move" is one value.
  return { x: shiftAlong(region.x, region.width, room.x, room.width) + 0, y: shiftAlong(region.y, region.height, room.y, room.height) + 0 }
}
