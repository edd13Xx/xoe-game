import { XOE_IDENTITY_LINE } from "./brand.ts"
/**
 * Bundled offline lore / Q&A corpus for Backup AI retrieval.
 * Voice: warm, plain, short — like a knowledgeable friend. XOE stays the name.
 */

export interface CorpusEntry {
  id: string
  title: string
  /** Indexing text (questions + keywords + lore). */
  doc: string
  /** XOE-voiced answer template. */
  answer: string
}

export const COMPANION_CORPUS: readonly CorpusEntry[] = [
  // v18: Fees and leverage (bonus lesson). Sim examples only. Education only, not financial advice.
  {
    id: "fees-round-trip",
    title: "Trading fees",
    doc: "trading fee fees charged open close opening closing round trip twice both sides commission cost per trade",
    answer:
      "XO: Trading fees are paid twice — once to open and once to close. Sim example: $0.12 to open a $100 trade and $0.12 to close, so $0.24 round trip. Education only · sim and testnet · not financial advice.",
  },
  {
    id: "fees-break-even",
    title: "Break-even",
    doc: "break even breakeven break-even move needed percent how much does price need to move to profit cover fees 0.24 0.3 funding perp",
    answer:
      "XO: Break-even = round-trip fees ÷ trade size. Sim example: $0.24 ÷ $100 ≈ 0.24%. Price has to move about 0.24% your way just to get back to zero. Perp funding fees while you hold push it a bit higher, so about 0.3% is a safer number. Education only · sim and testnet · not financial advice.",
  },
  {
    id: "leverage-multiplies",
    title: "Leverage",
    doc: "leverage leveraged 5x 5 x 10x margin multiply multiplies gains losses wins 2 percent move 10 percent borrowed",
    answer:
      "XO: Leverage multiplies wins AND losses. At 5X, $20 controls a $100 trade, so a 2% move is $2 — that's 10% of your money, up or down. Education only · sim and testnet · not financial advice.",
  },
  {
    id: "leverage-liquidation",
    title: "Liquidation",
    doc: "liquidation liquidated liquidate wipe out wiped out margin call how far can price drop 20 percent drop 5x lose everything",
    answer:
      "XO: At 5X, about a 20% drop wipes out the money you put up (100% ÷ 5 = 20%). That's liquidation. Fees make it happen a little sooner. Education only · sim and testnet · not financial advice.",
  },
  {
    id: "leverage-cushion",
    title: "Cushion",
    doc: "cushion extra money collateral add margin buffer backing delay liquidation safer further away",
    answer:
      "XO: A cushion is extra money behind the trade. It moves the wipe-out point further away — at 5X a $10 cushion on $20 pushes it from about 20% down to about 30% down. It does not raise your gains, and you can lose the cushion too. Education only · sim and testnet · not financial advice.",
  },
  {
    id: "leverage-small-trades",
    title: "Smaller trades",
    doc: "smaller trade size small position size safer easier smaller bets trade less risk",
    answer:
      "XO: Smaller trades are safer, not easier. Wins and losses both shrink, but break-even stays about 0.24% at any size ($0.12 ÷ $50 is still 0.24%). Education only · sim and testnet · not financial advice.",
  },
  {
    id: "who-xoe",
    title: "Who is XO?",
    doc: "who are you what is xo xoe companion ui voice mascot class classified stats strength defense unknown orbital female built-in ai",
    answer:
      `XO: Hey Pilot — ${XOE_IDENTITY_LINE} I'm a state-of-the-art, cutting-edge unknown orbital; my class is classified, and so are my stats. I ride along as your companion and guide.`,
  },
  {
    id: "pilot-role",
    title: "Pilot role",
    doc: "pilot role player who am i cockpit fly ship",
    answer: "XO: You're the Pilot. I stay the companion. Points here are practice fiction — no pressure.",
  },
  {
    id: "moon-sol",
    title: "Moon Sol",
    doc: "sol moon fiery speed ember flare dash speed burst blink shield blocks mempool moon-pair-b hot fire",
    answer:
      "XO: Sol is the fiery speed moon — embers, linked blocks, quick moves. Flare Dash is optional if you want the speed kit.",
  },
  {
    id: "moon-xelm",
    title: "Moon Xelm",
    doc: "xelm moon cold keys frost frost lock freeze slow-mo security ashglass moon-pair-a quiet silence",
    answer:
      "XO: Xelm is the quiet key moon — frost, key-spires, calm focus. Frost Lock is optional if you like freeze tools.",
  },
  {
    id: "moons-choice",
    title: "Moon choice",
    doc: "moons choose moon path irreversible pick sol or xelm which moon",
    answer:
      "XO: Pick Sol or Xelm once per run. It sticks for that run. Powers are optional — take what feels right.",
  },
  {
    id: "keys",
    title: "Keys",
    doc: "keys private public seed phrase wallet access secret share never hand over",
    answer:
      "XO: A wallet is access — keys — not a pocket of coins. Public is fine to share. Private stays yours. Never hand anyone a seed phrase.",
  },
  {
    id: "seals",
    title: "Seals",
    doc: "seal seals hatch sealed refocus security lock vault",
    answer:
      "XO: Seals and hatches mark locked paths. Frost Lock on Xelm is optional practice help — not a real vault unlock.",
  },
  {
    id: "xlm-market",
    title: "XOE market chart",
    doc: "xlm stellar market chart price coin learning advice trade money cash bank",
    answer:
      "XO: The Market panel shows XOE from Coinbase's public price — learning only, not advice. No account tied in. Quotes can miss if you're offline.",
  },
  {
    id: "controls",
    title: "Controls",
    doc: "controls how to play move touch buttons keyboard navigate terrace hatch",
    answer:
      "XO: On a phone, use the on-screen buttons. On a keyboard, arrows work on the terrace. Market and Grok Bot live in the HUD whenever you need them.",
  },
  {
    id: "objectives",
    title: "Objectives",
    doc: "objective goal what do i do next colony map lesson ragnarok ending",
    answer:
      "XO: Clear colony lessons in order, pick a moon path, then face Ragnarok. Ending cuts to black. I'll keep the hints short.",
  },
  {
    id: "sis",
    title: "SIS",
    doc: "sis sai rescue terrace drones scoff bond unresolved",
    answer:
      "XO: SIS pulled you through on the terrace. That bond stays a little unresolved on purpose. I'm XOE, Unknown Orbital Engine — not SIS.",
  },
  {
    id: "grok-offline",
    title: "Grok Bot offline",
    doc: "grok ai assistant live account connect offline practice backup brain built-in",
    answer:
      "XO: Grok Bot access stays on. Paste your own xAI key for live replies. No key? I answer from built-in lore on this device. No nag, no account required.",
  },
  {
    id: "ragnarok",
    title: "Ragnarok",
    doc: "ragnarok boss fight quiz focus threat moon ability",
    answer:
      "XO: Ragnarok is a gated quiz fight. Protect keys, remember it's practice, and use a moon power if you equipped one.",
  },
  {
    id: "colonies",
    title: "Colonies",
    doc: "colony colonies wallet keys blocks fees scams lesson map",
    answer:
      "XO: Colonies teach wallet, keys, blocks, fees, and scams. Fly the right gate in arcade lessons. Ask me anytime — I've got you.",
  },
  {
    id: "money-fiction",
    title: "Real money",
    doc: "real money withdraw deposit bank transfer trade live wallet",
    answer:
      "XO: Nope. Testnet XOE · no real money. Nothing here moves real money or opens a live wallet.",
  },
] as const
