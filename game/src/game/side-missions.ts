/**
 * Occasional side missions between colonies.
 * Phishing = player spots red flags (tap/click).
 * Remote hack = DANGER mode — XOE takes mech control, auto-chases signal (input locked).
 * Testnet XOE · no real money. Never asks for real seeds/keys. Device-only prefs/scores.
 */

export const SIDE_MISSION_PREF_KEY = "xoe.sideMissions.v1"
export const SIDE_MISSION_SCORE_KEY = "xoe.sideMissionScores.v1"
export const SIDE_MISSION_COOLDOWN_KEY = "xoe.sideMissionCooldown.v1"
/** Min ms between side missions. */
export const SIDE_MISSION_MIN_GAP_MS = 90_000
/** Guarantee a mission after this many colony clears since last offer. */
export const SIDE_MISSION_PITY_CLEARS = 3

export type SideMissionKind = "phishing" | "remote-hack"

export interface SideMissionPref {
  enabled: boolean
}

export interface SideMissionChoice {
  id: string
  label: string
  /** True = correct reject / safe action for phishing. */
  ok: boolean
}

export interface SideMissionDef {
  id: string
  kind: SideMissionKind
  title: string
  blurb: string
  /** Shown after success. Plain XOE voice. */
  xoeAfter: string
  /** Paper points awarded on success. */
  points: number
  /** Phishing only — player picks. */
  choices?: readonly SideMissionChoice[]
  /** Hack danger cinematic beats (reduced-motion uses first+last). */
  dangerBeats?: readonly string[]
}

export interface SideMissionScoreBoard {
  totalPoints: number
  clears: number
  lastKind: SideMissionKind | null
  atMs: number
}

type Store = {
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
}

export const SIDE_MISSIONS: readonly SideMissionDef[] = [
  {
    id: "phish-support-dm",
    kind: "phishing",
    title: "Side mission · Fake support DM",
    blurb:
      "A DM says: “Support here — verify your vault or it locks in 5 minutes.” Your vault is cold storage. What do you do?",
    choices: [
      { id: "ignore", label: "Ignore / block — real teams don’t DM for seeds", ok: true },
      { id: "send-seed", label: "Send seed phrase to ‘unlock’ faster", ok: false },
      { id: "click", label: "Tap the lookalike link they sent", ok: false },
    ],
    xoeAfter:
      "XO: Good catch. That urgency DM was phishing. Cold storage means attackers can’t open the vault from a chat — so they try to trick you instead. Testnet XOE · no real money.",
    points: 40,
  },
  {
    id: "phish-airdrop",
    kind: "phishing",
    title: "Side mission · Fake airdrop",
    blurb:
      "A popup promises a free airdrop if you “connect wallet and paste your recovery words.” Red flags?",
    choices: [
      { id: "close", label: "Close it — airdrops never need your seed", ok: true },
      { id: "paste", label: "Paste recovery words to claim", ok: false },
      { id: "connect-hurry", label: "Connect fast before it expires", ok: false },
    ],
    xoeAfter:
      "XO: Fake airdrops love haste. Your vault stays cold — offline keys — so the scam needs you to hand them access. You didn’t. Testnet XOE · no real money.",
    points: 40,
  },
  {
    id: "hack-remote-access",
    kind: "remote-hack",
    title: "Side mission · Remote hack",
    blurb: "Hostile signal detected. Fake ‘remote access’ probe against the mech link.",
    dangerBeats: [
      "DANGER — XOE has control",
      "Tracing the hacker’s signal…",
      "Mech auto-follows the trail…",
      "Source locked. Blast away.",
      "Threat destroyed. Control returning.",
    ],
    xoeAfter:
      "XO: That was a remote-access trick. In danger I fly the mech for you. Your vault is cold storage — they can’t crack it from afar, so they jab the link instead. Blocked. Testnet XOE · no real money.",
    points: 55,
  },
  {
    id: "hack-sim-swap",
    kind: "remote-hack",
    title: "Side mission · SIM-swap style alert",
    blurb: "Spoofed carrier alert tries to hijack the pilot channel mid-route.",
    dangerBeats: [
      "DANGER — XOE has control",
      "Spoofed alert pinned…",
      "Chasing the signal spike…",
      "Source in sights — firing.",
      "Channel clean. You’re back in control.",
    ],
    xoeAfter:
      "XO: SIM-swap style noise. I took the stick so you weren’t steered into a bad approve. Cold vault stayed offline — untouchable. Testnet XOE · no real money.",
    points: 55,
  },
  {
    id: "hack-sign-trick",
    kind: "remote-hack",
    title: "Side mission · Signature trick",
    blurb: "Malicious signature-approval flood on the practice link.",
    dangerBeats: [
      "DANGER — XOE has control",
      "Rejecting forged approvals…",
      "Following the flood to its host…",
      "Host down. Debris clear.",
      "Stick returned. Nice flying.",
    ],
    xoeAfter:
      "XO: Signature spam is a remote hack pattern. I auto-piloted through it. Cold storage kept the vault off that wire. Testnet XOE · no real money.",
    points: 55,
  },
] as const

export function readSideMissionPref(store: Store | null): SideMissionPref {
  const fallback = { enabled: true }
  if (!store) return fallback
  try {
    const raw = store.getItem(SIDE_MISSION_PREF_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SideMissionPref>
    return { enabled: parsed.enabled !== false }
  } catch {
    return fallback
  }
}

export function writeSideMissionPref(store: Store | null, pref: SideMissionPref): boolean {
  if (!store) return false
  try {
    store.setItem(SIDE_MISSION_PREF_KEY, JSON.stringify({ enabled: pref.enabled === true }))
    return true
  } catch {
    return false
  }
}

export function readSideMissionScores(store: Store | null): SideMissionScoreBoard {
  const empty: SideMissionScoreBoard = { totalPoints: 0, clears: 0, lastKind: null, atMs: 0 }
  if (!store) return empty
  try {
    const raw = store.getItem(SIDE_MISSION_SCORE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<SideMissionScoreBoard>
    return {
      totalPoints: Math.max(0, Math.floor(Number(parsed.totalPoints) || 0)),
      clears: Math.max(0, Math.floor(Number(parsed.clears) || 0)),
      lastKind: parsed.lastKind === "phishing" || parsed.lastKind === "remote-hack" ? parsed.lastKind : null,
      atMs: typeof parsed.atMs === "number" ? parsed.atMs : 0,
    }
  } catch {
    return empty
  }
}

export function awardSideMissionPoints(
  store: Store | null,
  mission: SideMissionDef,
): SideMissionScoreBoard {
  const prev = readSideMissionScores(store)
  const next: SideMissionScoreBoard = {
    totalPoints: prev.totalPoints + mission.points,
    clears: prev.clears + 1,
    lastKind: mission.kind,
    atMs: Date.now(),
  }
  if (store) {
    try {
      store.setItem(SIDE_MISSION_SCORE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

export interface SideMissionCooldown {
  lastOfferAtMs: number
  clearsSinceOffer: number
}

export function readSideMissionCooldown(store: Store | null): SideMissionCooldown {
  const fallback = { lastOfferAtMs: 0, clearsSinceOffer: 0 }
  if (!store) return fallback
  try {
    const raw = store.getItem(SIDE_MISSION_COOLDOWN_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<SideMissionCooldown>
    return {
      lastOfferAtMs: typeof p.lastOfferAtMs === "number" ? p.lastOfferAtMs : 0,
      clearsSinceOffer: Math.max(0, Math.floor(Number(p.clearsSinceOffer) || 0)),
    }
  } catch {
    return fallback
  }
}

export function writeSideMissionCooldown(store: Store | null, cd: SideMissionCooldown): void {
  if (!store) return
  try {
    store.setItem(SIDE_MISSION_COOLDOWN_KEY, JSON.stringify(cd))
  } catch {
    /* ignore */
  }
}

export function noteColonyClearForSideMissions(store: Store | null): SideMissionCooldown {
  const prev = readSideMissionCooldown(store)
  const next = { ...prev, clearsSinceOffer: prev.clearsSinceOffer + 1 }
  writeSideMissionCooldown(store, next)
  return next
}

/** Steady pace: min gap + pity after N clears, else ~28% roll. */
export function shouldOfferSideMission(
  store: Store | null,
  clearedCount: number,
  rng: () => number = Math.random,
  nowMs: number = Date.now(),
): boolean {
  if (!readSideMissionPref(store).enabled) return false
  if (clearedCount < 1) return false
  const cd = readSideMissionCooldown(store)
  if (nowMs - cd.lastOfferAtMs < SIDE_MISSION_MIN_GAP_MS && cd.clearsSinceOffer < SIDE_MISSION_PITY_CLEARS) {
    return false
  }
  if (cd.clearsSinceOffer >= SIDE_MISSION_PITY_CLEARS) return true
  return rng() < 0.28
}

export function markSideMissionOffered(store: Store | null, nowMs: number = Date.now()): void {
  writeSideMissionCooldown(store, { lastOfferAtMs: nowMs, clearsSinceOffer: 0 })
}

export function pickSideMission(
  rng: () => number = Math.random,
  preferKind?: SideMissionKind | null,
): SideMissionDef {
  const pool = preferKind
    ? SIDE_MISSIONS.filter((m) => m.kind === preferKind)
    : [...SIDE_MISSIONS]
  const list = pool.length ? pool : SIDE_MISSIONS
  const i = Math.min(list.length - 1, Math.floor(rng() * list.length))
  return list[i]!
}

export function missionById(id: string): SideMissionDef | null {
  return SIDE_MISSIONS.find((m) => m.id === id) ?? null
}

/** Input (tap/click/keyboard fly) locked during remote-hack danger cinematic. Skip still allowed. */
export function isDangerInputLocked(kind: SideMissionKind, phase: "intro" | "play" | "danger" | "fight" | "done"): boolean {
  return kind === "remote-hack" && phase === "danger"
}

export const COLD_STORAGE_STORY =
  "Your vault is cold storage — attackers can’t break in from the network. That’s why they phish you or jab the mech link instead."
