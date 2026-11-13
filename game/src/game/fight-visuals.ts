/** Pure helpers for the fight field visuals (enemy craft, HP bars, XO's targeting beam). Visual only. */

/** XO craft anchor inside the fight field, in % of field width/height (matches FightView). */
export const XO_ANCHOR = { x: 18, y: 70 } as const

/** Hull percent for an enemy HP bar, clamped 0..100 and rounded. */
export function enemyHpPct(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (hp / maxHp) * 100)))
}

/** Bar colour band: healthy, worn, critical. */
export function enemyHpTone(pct: number): "ok" | "warn" | "bad" {
  if (pct > 50) return "ok"
  if (pct > 25) return "warn"
  return "bad"
}

/** Straight beam from XO's nose to a target, both in field %; the start sits a little ahead of the craft. */
export function beamLine(target: { x: number; y: number }, from: { x: number; y: number } = XO_ANCHOR) {
  const x1 = from.x + 4
  const y1 = from.y - 1
  return { x1, y1, x2: target.x, y2: target.y }
}

/* ---- ZOE-style boost dash (visual feel only; timing reuses combat DODGE_MS / DODGE_COOLDOWN_MS, no game numbers change) ---- */

/** Two field taps this close together (ms) and this near (px) count as a double-tap dash on phones. */
export const DASH_DOUBLE_TAP_MS = 320
export const DASH_DOUBLE_TAP_PX = 48
/** A quick horizontal swipe on the field: at least this far (px), within this time (ms). */
export const DASH_SWIPE_PX = 40
export const DASH_SWIPE_MS = 380
/** How far XO's craft visibly lunges during a dash, in px (movement feel only). */
export const DASH_TRAVEL_PX = 56
/** Afterimage silhouettes left behind during a dash. */
export const DASH_AFTERIMAGES = 3

export type DashDir = 1 | -1
export type PointerMark = { x: number; y: number; t: number }

/** True when this tap follows the previous one quickly and close by (double-tap dash). */
export function isDoubleTap(prev: PointerMark | null, now: PointerMark): boolean {
  if (!prev) return false
  const dt = now.t - prev.t
  if (!(dt > 0 && dt <= DASH_DOUBLE_TAP_MS)) return false
  return Math.hypot(now.x - prev.x, now.y - prev.y) <= DASH_DOUBLE_TAP_PX
}

/** A fast, mostly-horizontal swipe returns its direction (1 forward/right, -1 back/left); otherwise null. */
export function swipeDashDir(start: PointerMark | null, end: PointerMark): DashDir | null {
  if (!start) return null
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dt = end.t - start.t
  if (!(dt >= 0 && dt <= DASH_SWIPE_MS)) return null
  if (Math.abs(dx) < DASH_SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return null
  return dx > 0 ? 1 : -1
}

/** Cooldown ring fill 0..1 (1 = dash ready) from the existing dodge timing. */
export function dashReadyFrac(dodgeUntilMs: number, nowMs: number, dashMs: number, cooldownMs: number): number {
  if (!dodgeUntilMs || !Number.isFinite(dodgeUntilMs) || cooldownMs <= 0) return 1
  const startedAt = dodgeUntilMs - dashMs
  const frac = (nowMs - startedAt) / cooldownMs
  return Math.min(1, Math.max(0, frac))
}

/** Afterimage timings: each ghost trails a little later and fainter. Reduced motion: none. */
export function dashAfterimages(reduced: boolean): { i: number; delayMs: number; opacity: number }[] {
  if (reduced) return []
  return Array.from({ length: DASH_AFTERIMAGES }, (_, i) => ({ i, delayMs: 45 * (i + 1), opacity: Math.round((0.55 - i * 0.15) * 100) / 100 }))
}

/** Deterministic speed-line streaks (field %), seeded per dash. Reduced motion: none. */
export function dashSpeedLines(seed: number, reduced: boolean, count = 7): { top: number; len: number; delayMs: number }[] {
  if (reduced) return []
  const out: { top: number; len: number; delayMs: number }[] = []
  let s = (Math.abs(Math.floor(seed)) * 2654435761 + 97) >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  for (let i = 0; i < count; i++) {
    out.push({ top: Math.round(8 + rnd() * 84), len: Math.round(18 + rnd() * 26), delayMs: Math.round(rnd() * 120) })
  }
  return out
}

/* ---- Condition energy lines + ring radar (visual/readability only; no combat numbers change) ---- */

export type XoCondition = { tone: "stable" | "strained" | "critical"; label: string; color: string; pct: number }

/** Status written on XO's body: cyan when stable, gold when strained, red near loss. Uses hull only. */
export function xoCondition(hp: number, maxHp: number): XoCondition {
  const pct = enemyHpPct(hp, maxHp)
  if (pct > 60) return { tone: "stable", label: "Stable", color: "#5ee7ff", pct }
  if (pct > 30) return { tone: "strained", label: "Strained", color: "#ffc857", pct }
  return { tone: "critical", label: "Critical", color: "#ff4d6d", pct }
}

/** Seconds per energy-line flow loop; faster when strained, fastest when critical. 0 means still (reduced motion). */
export function conditionFlowSec(tone: XoCondition["tone"], reduced: boolean): number {
  if (reduced) return 0
  return tone === "stable" ? 1.6 : tone === "strained" ? 1.0 : 0.55
}

export type RadarBlip = { id: string; x: number; y: number; near: boolean }

/** Ring radar blips: alive enemies placed around XO (center 50,50 in a 100-box), clamped inside the ring. */
export function radarBlips(
  enemies: { id: string; x: number; y: number; alive: boolean }[],
  from: { x: number; y: number } = XO_ANCHOR,
  ringR = 40,
  nearPct = 35,
): RadarBlip[] {
  return enemies
    .filter((e) => e.alive && Number.isFinite(e.x) && Number.isFinite(e.y))
    .map((e) => {
      const dx = e.x - from.x
      const dy = e.y - from.y
      const dist = Math.hypot(dx, dy)
      const scale = dist === 0 ? 0 : Math.min(ringR, (dist / 100) * ringR * 1.4) / dist
      return { id: e.id, x: Math.round((50 + dx * scale) * 10) / 10, y: Math.round((50 + dy * scale) * 10) / 10, near: dist <= nearPct }
    })
}
