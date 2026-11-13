import type { SolarFlareState } from "./solar-flare.ts"
import type { XoeSimState } from "./xoe-sim-price.ts"

/** Process one 1.2s XOE tick through the active flare, if any. */
export interface FlareController {
  peek: () => SolarFlareState
  onSimTick: (sim: XoeSimState, noise: number, now: number) => { sim: XoeSimState; flare: SolarFlareState }
}

let bound: FlareController | null = null

export function bindFlareController(controller: FlareController | null): void {
  bound = controller
}

export function flareController(): FlareController | null {
  return bound
}
