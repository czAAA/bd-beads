import type { Wheel } from '../homepage/wheelTurn'

/** A trackpad's wheel events come a screen frame apart, in ms. */
const FRAME = 16
/** The fingers' part of a swipe, in px an event: it ramps up, no event twice the one before once it moves. */
const FINGERS = [1, 2, 4, 8, 14, 22, 30, 36, 40, 40, 38, 36]
/** Momentum's first event, in px: a little under the fingers' last. */
const MOMENTUM = 34
/** What momentum keeps of its speed from one event to the next: a second or more until it is gone. */
const FADE = 0.955
/** Momentum's last events, in px: a few of a pixel each before it stops. */
const LAST = [1, 1, 1, 1]
/** How long before a swipe's first event the momentum before it ends, in ms: the fingers land, then move. */
const LANDING = 48

/** One swipe: when it begins in ms, how strong (1 peaks at 40px an event) and which way (1 down, -1 up). */
export interface Swipe {
  at: number
  strength?: number
  way?: 1 | -1
}

/** A Mac trackpad swipe as the page gets it (ticket 1131): the fingers ramping up, then momentum fading out. */
function trackpadSwipe({ at, strength = 1, way = 1 }: Swipe): Wheel[] {
  const deltas = FINGERS.map((delta) => Math.max(1, Math.round(delta * strength)))
  for (let delta = MOMENTUM * strength; delta >= 1; delta *= FADE) deltas.push(Math.round(delta))
  deltas.push(...LAST)
  return deltas.map((delta, index) => ({ delta: delta * way, time: at + index * FRAME }))
}

/** Trackpad swipes one after another (ticket 1131): the fingers landing for the next end the momentum before it. */
export function trackpadSwipes(...swipes: Swipe[]): Wheel[] {
  return swipes.flatMap((swipe, index) => {
    const next = swipes[index + 1]
    return trackpadSwipe(swipe).filter((wheel) => !next || wheel.time < next.at - LANDING)
  })
}

/** The wheels as a busy page gets them (ticket 1131): every `every`th run of `run` events lumped into one. */
export function lumped(wheels: Wheel[], every: number, run: number): Wheel[] {
  const out: Wheel[] = []
  for (let index = 0; index < wheels.length; ) {
    const lump = index % every === every - 1 ? wheels.slice(index, index + run) : [wheels[index]!]
    out.push({ delta: lump.reduce((sum, wheel) => sum + wheel.delta, 0), time: lump.at(-1)!.time })
    index += lump.length
  }
  return out
}

/** Wheel events as recorded, each `[ms since the first, px]`. */
function recorded(wheels: [number, number][]): Wheel[] {
  return wheels.map(([time, delta]) => ({ delta, time }))
}

/** Four swipes down on a MacBook trackpad in Safari, as recorded (ticket 1131): they begin 0, 517, 1116 and 1733ms in,
 * each in the momentum of the one before, the fingers landing about 45ms before they move. */
export const RECORDED_FOUR_SWIPES = recorded([
  [0, 1], [23, 3], [30, 7], [52, 14], [71, 23], [84, 35], [96, 38], [113, 27], [121, 45], [137, 52], [154, 56],
  [170, 55], [187, 54], [204, 53], [221, 55], [237, 53], [255, 49], [271, 45], [288, 43], [305, 39], [322, 36],
  [339, 33], [356, 30], [372, 28], [389, 26], [406, 24], [422, 21], [439, 19], [456, 17], [472, 16], [517, 2],
  [533, 5], [548, 14], [567, 25], [585, 30], [598, 29], [615, 26], [635, 21], [651, 32], [664, 37], [679, 39],
  [698, 39], [714, 39], [731, 37], [749, 42], [764, 39], [782, 37], [798, 34], [814, 31], [830, 28], [849, 26],
  [865, 24], [881, 22], [898, 20], [914, 19], [932, 17], [949, 16], [965, 14], [981, 13], [999, 12], [1015, 11],
  [1031, 10], [1050, 9], [1064, 8], [1116, 3], [1133, 11], [1148, 16], [1165, 19], [1183, 34], [1198, 37],
  [1215, 29], [1241, 30], [1247, 22], [1260, 42], [1269, 50], [1286, 52], [1302, 53], [1319, 52], [1335, 49],
  [1352, 53], [1369, 53], [1386, 49], [1402, 44], [1420, 41], [1436, 38], [1453, 35], [1469, 33], [1486, 29],
  [1503, 26], [1519, 24], [1536, 22], [1553, 21], [1569, 19], [1586, 18], [1603, 15], [1619, 14], [1636, 13],
  [1653, 12], [1669, 11], [1686, 10], [1733, 2], [1749, 4], [1766, 10], [1782, 17], [1799, 32], [1814, 53],
  [1834, 59], [1849, 61], [1864, 44], [1879, 34], [1886, 69], [1903, 82], [1918, 85], [1936, 84], [1952, 82],
  [1969, 78], [1985, 82], [2003, 77], [2019, 72], [2036, 68], [2053, 62], [2069, 60], [2086, 55], [2103, 50],
  [2131, 46], [2135, 43], [2154, 40], [2169, 36],
])

/** One swipe up on the same trackpad, its momentum left to fade for a second (ticket 1131). */
export const RECORDED_ONE_SWIPE = recorded([
  [0, -1], [1, -2], [14, -5], [30, -8], [48, -13], [65, -22], [80, -26], [97, -28], [117, -19], [133, -29],
  [148, -32], [165, -33], [181, -33], [198, -33], [214, -32], [231, -36], [248, -35], [265, -32], [281, -29],
  [297, -26], [314, -24], [332, -22], [348, -20], [369, -19], [380, -17], [398, -16], [415, -14], [432, -13],
  [448, -12], [464, -11], [481, -10], [497, -9], [515, -8], [531, -8], [547, -7], [564, -7], [581, -6], [597, -5],
  [614, -5], [630, -5], [647, -5], [663, -4], [680, -4], [697, -4], [715, -3], [731, -3], [747, -3], [764, -2],
  [781, -2], [797, -2], [813, -2], [833, -2], [847, -1], [864, -1], [881, -1], [897, -1], [914, -1], [947, -1],
  [964, -1], [998, -1],
])
