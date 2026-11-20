import { ROW_WAYS, type ShownWay } from './rowProgress'

/** The way Row by row's rows run (Export panel): as Row progress runs them (the choice until another is made), or one of
 * the four ways as seen. */
export type RowByRowWay = 'progress' | ShownWay

/** The saved text a way stands for, or undefined when it is none. */
export function parseRowByRowWay(raw: string): RowByRowWay | undefined {
  return raw === 'progress' ? raw : ROW_WAYS.find((way) => way === raw)
}
