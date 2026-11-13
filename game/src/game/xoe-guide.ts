/**
 * XOE scripted offline companion — UI voice + hints.
 * Not live AI. No API. No key. Rename in pregame still applies to display name.
 */

import { COLONIES, colonyById, RAGNAROK_QUESTIONS } from "./colonies.ts"

export const XOE_SCRIPTED_LABEL = "XOE: built-in AI when no key · live Grok Bot with your key"

export const XOE_ABOUT =
  "XO is your companion and UI voice — warm, plain, short answers. Built-in AI on device, or live Grok Bot with your own key. SIS stays separate."

export interface XoeTip {
  id: string
  label: string
  reply: string
}

const SHARED_TIPS: readonly XoeTip[] = [
  {
    id: "who",
    label: "Who are you?",
    reply: "Hey — I'm XOE, Unknown Orbital Engine. Call me XO. I'm with you on this practice run. Ask me anything; I'll keep it short and clear.",
  },
  {
    id: "pilot",
    label: "Who is the Pilot?",
    reply: "You are always the Pilot. I fly with you. Practice points stay fictional.",
  },
  {
    id: "money",
    label: "Is this real money?",
    reply: "No. Testnet XOE · no real money. Nothing here moves real money or opens a live wallet.",
  },
  {
    id: "sis",
    label: "What about SIS?",
    reply: "SIS rescued you on the terrace path. That bond stays unresolved on purpose. I'm not SIS.",
  },
]

const COLONY_TIPS: Record<string, readonly XoeTip[]> = {
  wallet: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "A wallet is access — keys — not a pocket of coins. Pick the answer about private keys.",
    },
  ],
  keys: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Public can be shared. Private stays secret. Never hand over a seed phrase.",
    },
  ],
  blocks: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Blocks link backward so rewriting history is hard. That chain is the point.",
    },
  ],
  fees: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Fees pay the network to process your transaction, not a stranger in chat. Stay with the practice framing.",
    },
  ],
  scams: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Urgency and “send to verify” are classic scams. Slow down and block.",
    },
  ],
  phishing: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Fake support DMs and lookalike URLs want your seed. Never share keys. Type the real site yourself.",
    },
  ],
  "seed-backup": [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Offline paper or metal backup. Never photos, never cloud, never share. We never ask for a real seed.",
    },
  ],
  trustline: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "A trustline is permission to hold an asset — not free coins. Testnet XOE · no real money.",
    },
  ],
  stroops: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Stroops are tiny slices of XLM so fees can be precise. Still fictional here.",
    },
  ],
  volatility: [
    {
      id: "hint",
      label: "Hint for this colony",
      reply: "Swings teach patience. Keep size small and don't chase. Testnet XOE · no real money.",
    },
  ],
}

const RAGNAROK_TIPS: readonly XoeTip[] = [
  {
    id: "hint",
    label: "Hint for this fight",
    reply: "Protect keys, remember practice is fiction, and when my lifeblood becomes the weapon — sacrifice the suit.",
  },

]

export function tipsForColony(colonyId: string | null): readonly XoeTip[] {
  const extra = colonyId ? (COLONY_TIPS[colonyId] ?? []) : []
  return [...SHARED_TIPS, ...extra]
}

export function tipsForRagnarok(): readonly XoeTip[] {
  return [...SHARED_TIPS, ...RAGNAROK_TIPS]
}

export function tipsForMap(): readonly XoeTip[] {
  return [
    ...SHARED_TIPS,
    {
      id: "map",
      label: "What do I do next?",
      reply: `Clear each colony in order: ${COLONIES.map((c) => c.name).join(", ")}. Then face Ragnarok.`,
    },
  ]
}

export function contextLine(args: {
  companionName: string
  phase: "colony-map" | "colony-lesson" | "ragnarok" | "ending" | "blackout"
  colonyId: string | null
  bossStep: number
}): string {
  const name = args.companionName.trim() || "XO"
  if (args.phase === "colony-map") {
    return `${name}: Pilot, pick a colony. I'll frame each lesson in plain words.`
  }
  if (args.phase === "colony-lesson") {
    const colony = args.colonyId ? colonyById(args.colonyId) : null
    return colony
      ? `${name}: ${colony.lesson}`
      : `${name}: Stay with the lesson. Ask me for a hint if you need one.`
  }
  if (args.phase === "ragnarok") {
    const q = RAGNAROK_QUESTIONS[args.bossStep]
    return q
      ? `${name}: Steady, Pilot. ${RAGNAROK_QUESTIONS.length - args.bossStep} beat(s) left in this quiz fight.`
      : `${name}: The quiz gate is clear.`
  }
  if (args.phase === "ending") {
    return `${name}: My lifeblood becomes the weapon. You are still the Pilot.`
  }
  return `${name}: Cut to black.`
}

export function matchKeywordTip(query: string, tips: readonly XoeTip[]): XoeTip | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  if (/(money|cash|bank|withdraw|real)/.test(q)) return tips.find((t) => t.id === "money") ?? null
  if (/(sis|sai)/.test(q)) return tips.find((t) => t.id === "sis") ?? null
  if (/(who are you|what are you|companion)/.test(q)) return tips.find((t) => t.id === "who") ?? null
  if (/(hint|help|stuck)/.test(q)) return tips.find((t) => t.id === "hint") ?? tips[0] ?? null
  if (/(math|percent|5|15|boss)/.test(q)) return tips.find((t) => t.id === "math") ?? null
  if (/(next|map|colony)/.test(q)) return tips.find((t) => t.id === "map") ?? tips.find((t) => t.id === "hint") ?? null
  return null
}


/** Short scripted beats with XOE so each roster face feels present. Not new canon. */
export const ROSTER_LINES = {
  xoe: "XO: Still your companion and UI voice — even if you rename me on the card.",
  "mara-venn": "XO: Mara Venn holds the line like a Sentinel. High defense energy — flavor only in this opening.",
  "elias-cho": "XO: Elias Cho keeps a Striker's balance. Average kit, steady hands — still practice fiction.",
  "nia-okonkwo": "XO: Nia Okonkwo reads as Recon. Strong specials on the roster — no live combat formula here.",
} as const

export function rosterLine(characterId: string): string {
  if (characterId === "xoe" || characterId === "mara-venn" || characterId === "elias-cho" || characterId === "nia-okonkwo") {
    return ROSTER_LINES[characterId]
  }
  return ROSTER_LINES.xoe
}
