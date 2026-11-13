/**
 * Context hints for the header XOE help button.
 * Replies stay on the existing Grok Bot path (player key, grok-4.7) or built-in AI.
 */
import type { XoeTip } from "./xoe-guide.ts"
import { tipsForColony, tipsForMap, tipsForRagnarok } from "./xoe-guide.ts"

export type HelpContextId =
  | "map"
  | "fight"
  | "trade"
  | "lesson"
  | "moon"
  | "story"
  | "menu"
  | "recap"
  | "ending"
  | "ragnarok"

export function helpContextFor(opts: {
  phase: string
  inFight?: boolean
  trading?: boolean
  justCleared?: boolean
}): HelpContextId {
  if (opts.trading) return "trade"
  if (opts.inFight) return "fight"
  if (opts.justCleared) return "recap"
  const phase = opts.phase
  if (phase === "colony-map") return "map"
  if (phase === "colony-lesson") return "lesson"
  if (phase === "moon-choice" || phase === "moon-approach") return "moon"
  if (phase === "ragnarok") return "ragnarok"
  if (phase === "ending" || phase === "blackout") return "ending"
  if (
    phase === "practice" ||
    phase === "practice-pause"
  ) {
    return "trade"
  }
  if (
    phase === "wake" ||
    phase === "missing-pilot" ||
    phase === "cinematic" ||
    phase === "cinematic-choice" ||
    phase === "sis-rescue" ||
    phase === "navigate" ||
    phase === "near-loss" ||
    phase === "auto-battle" ||
    phase === "cockpit-invite"
  ) {
    return "story"
  }
  return "menu"
}

const FIGHT_TIPS: readonly XoeTip[] = [
  {
    id: "pre-fight",
    label: "Pre-fight tip",
    reply: "Lock on, dash to slip shots, and fire in short bursts. This is a practice fight — testnet only, no real money.",
  },
]

const TRADE_TIPS: readonly XoeTip[] = [
  {
    id: "trade-desk",
    label: "How this desk works",
    reply: "The ship rides the XOE/USD sim price. Enemy bots are simulated. Fire and dash to defend it. Buy and Sell still work, and nothing here changes your caps or rewards. Pause or ease combat whenever you want.",
  },
  {
    id: "rsi",
    label: "What is RSI?",
    reply: "RSI(14) here is a simulated readout from the in-game price history. It is not a live market signal and not financial advice.",
  },
]

const RECAP_TIP: XoeTip = {
  id: "recap",
  label: "Recap this colony",
  reply: "Nice clear. The lesson stays in this run as practice knowledge. Want a short recap or a question for me?",
}

const MOON_TIPS: readonly XoeTip[] = [
  {
    id: "moon-path",
    label: "Moon path",
    reply: "Sol is fiery and fast; Xelm is cold and quiet. Powers stay optional. You choose the path only after the colonies, on the existing moon screen.",
  },
]

const STORY_TIPS: readonly XoeTip[] = [
  {
    id: "story",
    label: "Where am I?",
    reply: "This is the opening path — practice and story only. I'm XOE, Unknown Orbital Engine. Ask when you want a short pointer.",
  },
]

const MENU_TIPS: readonly XoeTip[] = [
  {
    id: "menu",
    label: "What can I do here?",
    reply: "Start or resume from this menu, set music and Grok Bot, and open the paper trade desk when you want it. Voice stays off until you opt in.",
  },
]

const ENDING_TIPS: readonly XoeTip[] = [
  {
    id: "ending",
    label: "What just happened?",
    reply: "That's the closing beat of this practice run. Nothing here moved real money. I'm still XOE, Unknown Orbital Engine.",
  },
]

export function tipsForHelp(ctx: HelpContextId, colonyId?: string | null): readonly XoeTip[] {
  if (ctx === "map") return tipsForMap()
  if (ctx === "lesson") return tipsForColony(colonyId ?? null)
  if (ctx === "ragnarok") return tipsForRagnarok()
  if (ctx === "fight") return FIGHT_TIPS
  if (ctx === "trade") return TRADE_TIPS
  if (ctx === "recap") return [RECAP_TIP, ...tipsForColony(colonyId ?? null)]
  if (ctx === "moon") return MOON_TIPS
  if (ctx === "story") return STORY_TIPS
  if (ctx === "ending") return ENDING_TIPS
  return MENU_TIPS
}

export function helpPrefill(ctx: HelpContextId): string {
  if (ctx === "map") return "Any tips for flying the colony map?"
  if (ctx === "fight") return "Any pre-fight tips for this practice battle?"
  if (ctx === "trade") return "How does the simulated trade desk and price ship work?"
  if (ctx === "lesson") return "Can you explain this colony lesson in short words?"
  if (ctx === "recap") return "Can you recap the colony I just cleared?"
  if (ctx === "moon") return "How do Sol and Xelm moon paths work?"
  if (ctx === "ragnarok") return "Any tips before the last flight?"
  if (ctx === "ending") return "What should I take away from this practice run?"
  if (ctx === "story") return "Where am I in the opening story?"
  return "What can I do from this screen?"
}
