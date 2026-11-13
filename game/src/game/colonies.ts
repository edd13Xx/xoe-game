/** Colony arcade lessons + Ragnarok flight gates. Prototype content — not promoted to canon. */

export interface ColonyChoice {
  text: string
  ok: boolean
}

export interface ArcadeGate {
  label: string
  ok: boolean
  lane: number
}

export interface ArcadePickup {
  label: string
  lane: number
  xoeLine: string
}

export interface ColonyLesson {
  id: string
  name: string
  lesson: string
  /** Legacy quiz fields kept for compatibility; arcade uses gates. */
  question: string
  choices: readonly ColonyChoice[]
  gates: readonly ArcadeGate[]
  pickups: readonly ArcadePickup[]
  teach: string
}

function gatesFromChoices(choices: readonly ColonyChoice[]): ArcadeGate[] {
  return choices.map((c, i) => ({ label: c.text, ok: c.ok, lane: i }))
}

export const COLONIES: readonly ColonyLesson[] = [
  {
    id: "wallet",
    name: "Colony Wallet",
    lesson: "A wallet holds your keys, not your coins.",
    question: "What does a crypto wallet mainly hold?",
    choices: [
      { text: "Your private keys / access", ok: true },
      { text: "Physical gold bars", ok: false },
      { text: "The whole blockchain", ok: false },
    ],
    gates: [
      { label: "Keys / access", ok: true, lane: 1 },
      { label: "Gold bars", ok: false, lane: 0 },
      { label: "Whole chain", ok: false, lane: 2 },
    ],
    pickups: [
      { label: "Key fact", lane: 0, xoeLine: "XO: Think of a wallet like a key ring, not a piggy bank." },
      { label: "Practice", lane: 2, xoeLine: "XO: Nothing here opens a live wallet. Testnet XOE · no real money." },
    ],
    teach: "Think of a wallet like a key ring, not a piggy bank.",
  },
  {
    id: "keys",
    name: "Colony Keys",
    lesson: "Public key: share it. Private key: never share it.",
    question: "Someone asks for your private key or seed phrase. What do you do?",
    choices: [
      { text: "Refuse. Never share the secret", ok: true },
      { text: "Send it so they can “help”", ok: false },
      { text: "Post it in a public chat", ok: false },
    ],
    gates: gatesFromChoices([
      { text: "Refuse. Never share", ok: true },
      { text: "Send for “help”", ok: false },
      { text: "Post in chat", ok: false },
    ]),
    pickups: [
      { label: "Public vs private", lane: 1, xoeLine: "XO: Public can be shared. Private stays secret." },
    ],
    teach: "If someone asks for your private key or seed phrase, that is a hard no.",
  },
  {
    id: "blocks",
    name: "Colony Blocks",
    lesson: "Blocks link in a chain, so history is hard to rewrite.",
    question: "Why are blocks chained together?",
    choices: [
      { text: "To make past records hard to rewrite", ok: true },
      { text: "To make phones charge faster", ok: false },
      { text: "To hide all names forever automatically", ok: false },
    ],
    gates: gatesFromChoices([
      { text: "Hard to rewrite past", ok: true },
      { text: "Charge phones", ok: false },
      { text: "Hide all names", ok: false },
    ]),
    pickups: [
      { label: "Chain link", lane: 2, xoeLine: "XO: Each block points at the one before it — that link is the chain." },
    ],
    teach: "Each block points at the one before it — that link is the “chain.”",
  },
  {
    id: "fees",
    name: "Colony Fees",
    lesson: "Network fees pay the network to process your transaction.",
    question: "What are network fees for in this lesson?",
    choices: [
      { text: "Paying the network to process and include a transaction", ok: true },
      { text: "A tip to a stranger in chat", ok: false },
      { text: "Buying a real bank withdrawal", ok: false },
    ],
    gates: gatesFromChoices([
      { text: "Pay the network to process it", ok: true },
      { text: "Tip a stranger", ok: false },
      { text: "Bank withdrawal", ok: false },
    ]),
    pickups: [
      { label: "Fee fact", lane: 0, xoeLine: "XO: Fees are not a tip to a stranger in chat." },
    ],
    teach: "Fees are not a tip to a stranger in chat. They go to the network for processing.",
  },
  {
    id: "stroops",
    name: "Colony Stroops",
    lesson: "A stroop is the smallest Stellar unit: 0.0000001 XLM.",
    question: "What is a stroop in this lesson?",
    choices: [
      { text: "A tiny fraction of XLM used for precise amounts and fees", ok: true },
      { text: "A type of scam DM", ok: false },
      { text: "A real bank wire", ok: false },
    ],
    gates: [
      { label: "Tiny XLM fraction", ok: true, lane: 0 },
      { label: "Scam DM", ok: false, lane: 1 },
      { label: "Bank wire", ok: false, lane: 2 },
    ],
    pickups: [
      { label: "Fee scale", lane: 1, xoeLine: "XO: Fees can be a few stroops. Still fictional here." },
    ],
    teach: "Stroops are tiny slices of XLM so amounts and fees can be precise.",
  },
  {
    id: "scams",
    name: "Colony Scams",
    lesson: "Scams love urgency. Real teams never DM you for seeds.",
    question: "A stranger DMs: “Send 1 coin to verify, get 2 back.” What do you do?",
    choices: [
      { text: "Ignore / block — classic scam", ok: true },
      { text: "Send the coin fast", ok: false },
      { text: "Share your seed phrase for help", ok: false },
    ],
    gates: gatesFromChoices([
      { text: "Ignore / block", ok: true },
      { text: "Send fast", ok: false },
      { text: "Share seed", ok: false },
    ]),
    pickups: [
      { label: "Slow down", lane: 1, xoeLine: "XO: Slow down. Nobody legitimate needs your seed phrase." },
    ],
    teach: "Slow down. Nobody legitimate needs your seed phrase.",
  },
  {
    id: "trustline",
    name: "Colony Trustline",
    lesson: "A trustline (a yes to a token) lets your account hold it.",
    question: "What does a trustline mainly do?",
    choices: [
      { text: "Lets an account hold a specific asset", ok: true },
      { text: "Sends real money to a stranger", ok: false },
      { text: "Deletes your private key", ok: false },
    ],
    gates: [
      { label: "Hold a specific asset", ok: true, lane: 1 },
      { label: "Send real money", ok: false, lane: 0 },
      { label: "Delete your key", ok: false, lane: 2 },
    ],
    pickups: [
      { label: "Trust tip", lane: 0, xoeLine: "XO: Think of a trustline as saying ‘I’m willing to hold this asset.’" },
      { label: "Testnet", lane: 2, xoeLine: "XO: Nothing here opens a live trustline. Testnet XOE · no real money." },
    ],
    teach: "A trustline is permission to hold an asset — not a free gift of coins.",
  },
  {
    id: "volatility",
    name: "Colony Volatility",
    lesson: "Volatility (fast price swings): keep trades small, don’t chase spikes.",
    question: "Price jumps hard in a second. What’s the calm move?",
    choices: [
      { text: "Slow down — size small, no chase", ok: true },
      { text: "All-in with real funds", ok: false },
      { text: "Share your seed to ‘hedge’", ok: false },
    ],
    gates: [
      { label: "Slow down · size small", ok: true, lane: 2 },
      { label: "All-in real funds", ok: false, lane: 0 },
      { label: "Share seed", ok: false, lane: 1 },
    ],
    pickups: [
      { label: "Swing tip", lane: 0, xoeLine: "XO: Swings teach patience. Flat is allowed." },
      { label: "Scam check", lane: 1, xoeLine: "XO: Urgency plus ‘send now’ is usually a scam." },
    ],
    teach: "Volatility swings fast — stay small, stay calm, Testnet XOE · no real money.",
  },
  {
    id: "phishing",
    name: "Colony Phishing",
    lesson: "Phishing (fake help that steals keys): real teams never ask.",
    question: "A ‘support’ DM says your wallet is locked and needs your seed phrase now. What do you do?",
    choices: [
      { text: "Ignore / block — never share seed or keys", ok: true },
      { text: "Paste the seed to ‘unlock’ faster", ok: false },
      { text: "Click the lookalike URL they sent", ok: false },
    ],
    gates: [
      { label: "Ignore · never share", ok: true, lane: 1 },
      { label: "Paste seed to unlock", ok: false, lane: 0 },
      { label: "Click lookalike URL", ok: false, lane: 2 },
    ],
    pickups: [
      { label: "URL check", lane: 0, xoeLine: "XO: Lookalike URLs swap one letter. Slow down and type the real site yourself." },
      { label: "Urgency", lane: 2, xoeLine: "XO: ‘Act now or lose funds’ is a nudge, not help. Testnet XOE · no real money." },
    ],
    teach: "Fake support and lookalike sites want your seed. Never share keys. Testnet XOE · no real money.",
  },
  {
    id: "seed-backup",
    name: "Colony Seed Backup",
    lesson: "Back up your seed offline, on paper or metal.",
    question: "What’s the safe way to store a seed phrase?",
    choices: [
      { text: "Offline paper or metal backup you control", ok: true },
      { text: "Photo in cloud album for ‘safety’", ok: false },
      { text: "DM it to ‘support’ for a free check", ok: false },
    ],
    gates: [
      { label: "Paper / metal offline", ok: true, lane: 0 },
      { label: "Cloud photo album", ok: false, lane: 1 },
      { label: "DM to support", ok: false, lane: 2 },
    ],
    pickups: [
      { label: "No photos", lane: 1, xoeLine: "XO: A phone photo can sync to the cloud. Keep backups offline." },
      { label: "Never share", lane: 2, xoeLine: "XO: We never ask for a real seed here. Practice labels only." },
    ],
    teach: "Store seeds offline on paper or metal. Never digital photos, never cloud, never share. Testnet XOE · no real money.",
  },

] as const

export interface BossQuestion {
  question: string
  choices: readonly ColonyChoice[]
}

export const RAGNAROK_QUESTIONS: readonly BossQuestion[] = [
  {
    question: "Ragnarok presses. What do you protect first?",
    choices: [
      { text: "Your private keys / seed (never share)", ok: true },
      { text: "A random DM “support” link", ok: false },
      { text: "Sending coins to “verify”", ok: false },
    ],
  },
  {
    question: "Practice funds feel tempting to treat as real. What is true here?",
    choices: [
      { text: "This is fiction — no real money moves", ok: true },
      { text: "This app can withdraw to your bank", ok: false },
      { text: "Winning means free mainnet tokens", ok: false },
    ],
  },
  {
    question: "XO's lifeblood can become the weapon. What does the Pilot do?",
    choices: [
      { text: "Sacrifice the mech suit to end it", ok: true },
      { text: "Sell the suit for practice points", ok: false },
      { text: "Hand the private key to Ragnarok", ok: false },
    ],
  },
] as const

export const RAGNAROK_NOTE =
  "Ragnarok is an arcade flight: protect keys and fly through safe gates."

export function colonyById(id: string): ColonyLesson | null {
  return COLONIES.find((colony) => colony.id === id) ?? null
}

export function colonyIndex(id: string): number {
  return COLONIES.findIndex((colony) => colony.id === id)
}

export function isColonyLocked(id: string, cleared: readonly string[]): boolean {
  const index = colonyIndex(id)
  if (index <= 0) return false
  const previous = COLONIES[index - 1]
  return previous ? !cleared.includes(previous.id) : true
}

export function allColoniesCleared(cleared: readonly string[]): boolean {
  return COLONIES.every((colony) => cleared.includes(colony.id))
}

export const ENDING_LINES = [
  "Ragnarok embodies the end of the world.",
  "XO's lifeblood becomes the weapon.",
  "The Pilot sacrifices the mech suit.",
  "SIS/SAI remains unresolved — on purpose.",
  "Cut to black. Practice only. No real money moved.",
] as const

export function isStoryColonyId(id: string): boolean {
  return COLONIES.some((c) => c.id === id)
}
