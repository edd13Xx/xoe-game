
import { xoSpeak } from "./xo-speech.ts"

/**
 * Total Liquidation cue — fire-and-forget.
 * Same moment as −4.4% hit / death: bubble + voice, does NOT await, does NOT delay red/fall.
 */
export function playTotalLiquidationSfx(): void {
  void xoSpeak("Getting totally liquidated.")
}

export const TOTAL_LIQUIDATION_LINE = "Getting totally liquidated."
