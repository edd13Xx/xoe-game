/**
 * v18.3 (XOE-004): in-game FAQ. Lives in the game file only — no site, nothing online.
 * Lessons are one short line each; the full explanations live here, in plain beginner words.
 * Jargon always gets a 3–5 word plain explanation in brackets.
 * Numbers come only from existing game copy or XOE-Spec-Reward-Plan-2026-11-09.md §9. Sim money only.
 */
import { COLONIES } from "./colonies.ts"
import { XOE_SIM_SAFETY } from "./xoe-sim-price.ts"

export type FaqId = "fees" | "leverage" | "liquidation" | "stop-loss" | "rewards" | "streaks" | "moons" | "basics"

export interface FaqSection {
  id: FaqId
  title: string
  lines: readonly string[]
  /** Prefill for "Ask XOE" on this section. */
  ask: string
}

/** Kept exactly: the locked funding line the verify check looks for. */
export const FAQ_FUNDING_LINE =
  "Holding a perp (a trade with no end date) also charges funding (a small holding fee), so about 0.3% is a safer number to plan with."

export const FAQ_SECTIONS: readonly FaqSection[] = [
  {
    id: "fees",
    title: "Fees",
    lines: [
      "Every trade pays a fee to open it and a fee to close it.",
      "Sim example: a $100 trade with a 0.12% fee pays $0.12 to open and $0.12 to close.",
      "That is $0.24 round trip (both fees together).",
      "Break-even (the move that gets you back to zero) = $0.24 ÷ $100 = about 0.24%.",
      FAQ_FUNDING_LINE,
      "Smaller trades are safer, not easier: a $50 trade pays $0.12 round trip. Still 0.24%.",
    ],
    ask: "Explain trading fees and break-even like I'm new.",
  },
  {
    id: "leverage",
    title: "Leverage",
    lines: [
      "Leverage (borrowed power, bigger swings) makes wins AND losses bigger.",
      "At 5X you put up $20 to control a $100 trade.",
      "A 2% move is $2. That is 10% of your $20, up or down.",
      "A cushion (extra money behind the trade) moves the wipe-out point: add $10 and it goes from about a 20% drop to about a 30% drop.",
      "Your win on a 2% move is still $2. And you can lose the cushion too.",
    ],
    ask: "Explain leverage like I'm new.",
  },
  {
    id: "liquidation",
    title: "Liquidation",
    lines: [
      "Liquidation (the trade gets force-closed) happens when a drop eats the money you put up.",
      "At 5X, about a 20% drop wipes out your $20 on a $100 trade.",
      "In XOE's sim, XO's Total Liquidation line sits 4.4% below your buy price. Hitting it costs an attempt.",
      "Losses never go below 0 and never cut your lifetime XOE.",
    ],
    ask: "Explain liquidation like I'm new.",
  },
  {
    id: "stop-loss",
    title: "Stop loss",
    lines: [
      "A stop loss (auto-sells at limit) sells for you if the price falls to a level you pick.",
      "Sim example: buy $100 of XOE and set a stop 5% lower. If the price falls, it sells near $95, so the loss stops near $5.",
      "A take profit (sells at your goal) does the same on the way up: set it 5% higher and it sells near $105.",
      "XOE's map trades don't have a stop loss yet, so you sell by hand.",
    ],
    ask: "Explain a stop loss like I'm new.",
  },
  {
    id: "rewards",
    title: "Rewards",
    lines: [
      "Rewards are testnet XOE only. No real money.",
      "Shipped local simulation rates only, not approved real or testnet payouts: lesson 0.2222 XOE, colony 1.1110, fight 0.0444, daily practice 0.4444, side mission 0.2222.",
      "Proposed monthly top 10 split (not approved): 888 XOE: 200 / 150 / 120 / 100 / 80 / 70 / 60 / 45 / 35 / 28.",
      "Halving timing and supply allocation are still for Eddie to choose. No live rewards are promised.",
      "All listed rates are simulation settings, not final reward promises. Weekly reward batches are a plan only. The batch day is still for Eddie to choose; claims are disabled.",
      "Clearing Ragnarok gives no XOE; it earns leaderboard placement. Milestone XOE tops out at 75 per player.",
    ],
    ask: "How do XOE rewards work? Explain like I'm new.",
  },
  {
    id: "streaks",
    title: "Streaks",
    lines: [
      "The local demo tracks play days. The final streak-day rule is still for Eddie to choose.",
      "A 7-day streak doubles earnings, up to your daily cap.",
      "A missed day resets the streak.",
    ],
    ask: "How do streaks work? Explain like I'm new.",
  },
  {
    id: "moons",
    title: "Moons",
    lines: [
      "Sol has Flare Dash, a burst of speed.",
      "Xelm has Frost Lock, which freezes time for 3s.",
      "Powers are optional. You can pick one or none.",
    ],
    ask: "Explain the moon powers like I'm new.",
  },
  {
    id: "basics",
    title: "Colony basics",
    lines: [
      "Wallet: a wallet holds your keys. It does not store coins like a pocket — it stores access.",
      "Keys: public key (your shareable address) is fine to share. Private key (your secret) never is.",
      "Stellar groups transactions into ledgers, not mined blocks. The ledger records the network history.",
      "Network fees: they pay the network to process your transaction. A higher fee can mean faster when busy.",
      "Scams: scams love urgency. Real teams will not DM you for seeds, remote access, or “verification fees.”",
      "Trustline (a yes to a token): without it, that token cannot sit in your account on Stellar.",
      "Stroops: the smallest Stellar unit, 0.0000001 XLM. Network fees are tiny.",
      "Volatility (fast price swings): keep size small and don't chase every spike.",
      "Phishing (fake help that steals keys): fake support DMs and lookalike links. Real teams never ask for your seed.",
      "Seed backup: back up seeds offline — paper or metal, locked away. Never photos, never cloud, never share.",
    ],
    ask: "Explain wallets, keys and seeds like I'm new.",
  },
] as const

export const FAQ_TITLE = "XOE FAQ"
export const FAQ_FOOTER = `${XOE_SIM_SAFETY}. Education only · not financial advice.`
/** The 5 topics Eddie asked for (verify checks these). */
export const FAQ_REQUIRED_TOPICS: readonly FaqId[] = ["fees", "leverage", "rewards", "streaks", "moons"]

export function faqSection(id: FaqId): FaqSection {
  return FAQ_SECTIONS.find((s) => s.id === id) ?? FAQ_SECTIONS[0]!
}

/** Which FAQ section a lesson's "Learn more" opens. */
export function faqForLesson(lessonId: string | null | undefined): FaqId {
  const id = String(lessonId ?? "")
  if (id.startsWith("fees-leverage")) {
    const step = Number(id.split(":")[1] ?? 0)
    return step === 2 || step === 4 ? "leverage" : step === 3 ? "liquidation" : "fees"
  }
  if (id === "volatility") return "stop-loss"
  if (id === "practice-exam" || id.startsWith("practice-exam")) return "basics"
  return COLONIES.some((c) => c.id === id) ? "basics" : "basics"
}

/** Word count used for the ≤12-word rule: tokens with a letter or digit (÷, =, —, · do not count). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}


/** Two plain questions per topic; retain original answer lines and deep-link IDs. */
const QUESTION_HEADINGS: Record<FaqId, readonly [string, string, number]> = {
  fees: ["What does a trading fee cost?", "How do funding and trade size affect fees?", 4],
  leverage: ["What does leverage change?", "Does extra collateral remove the risk?", 3],
  liquidation: ["What is liquidation?", "How does XOE limit simulated losses?", 2],
  "stop-loss": ["What are stop loss and take profit?", "Can the map sell automatically?", 3],
  rewards: ["Are XOE rewards real money?", "Which reward decisions are still provisional?", 2],
  streaks: ["How are play days counted?", "What happens to a seven-day streak?", 1],
  moons: ["What do Sol and Xelm do?", "Must I choose a moon power?", 2],
  basics: ["What should I know about wallets and transactions?", "How do I protect access and backups?", 5],
}
export function faqQuestions(section: FaqSection) {
  const [first, second, split] = QUESTION_HEADINGS[section.id]
  return [
    { id: `${section.id}-1`, question: first, lines: section.lines.slice(0, split) },
    { id: `${section.id}-2`, question: second, lines: section.lines.slice(split) },
  ]
}
