import { inject, provide, type InjectionKey, type Ref } from 'vue'

/** Keeps a control where it is on the screen while the popover around it changes size (ticket 1092): pressed again in
 * the same place, it undoes what the press did (the Bead colors list opening above its button). The popover's
 * placement owns it and hands it to the controls inside. */
export interface PlaceKeeper {
  /** Notes where the control is now, just before the press changes the popover; it stays there until `release`. */
  keep: (control: HTMLElement) => void
  /** The popover is placed as usual again (something else opened in it). */
  release: () => void
  /** How far right of its own place the kept control has to sit to stay under the press, in its own px. */
  shift: Readonly<Ref<number>>
  /** Whether the popover has more room to grow above itself than below, as it was last placed with nothing kept: where
   * what the control opens should go. */
  roomAbove: Readonly<Ref<boolean>>
}

const placeKeeperKey: InjectionKey<PlaceKeeper> = Symbol('placeKeeper')

/** A popover hands out how a control inside it keeps its place. */
export function providePlaceKeeper(keeper: PlaceKeeper) {
  provide(placeKeeperKey, keeper)
}

/** Absent (a host that places nothing, or mounted alone) means the control moves with its popover. */
export function usePlaceKeeper(): PlaceKeeper | undefined {
  return inject(placeKeeperKey, undefined)
}
