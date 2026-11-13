/**
 * Mech combat — attackers jab the mech because the vault is cold storage.
 * Sim/arcade points only. Difficulty Easy/Normal/Hard (device prefs).
 */

export const FIGHT_DIFFICULTY_KEY = "xoe.fightDifficulty.v1"
export const FIGHT_SCORE_KEY = "xoe.fightScores.v1"

export type FightDifficulty = "easy" | "normal" | "hard"
export type EnemyKind = "phish-drone" | "hack-probe" | "scam-swarm"
export type FightMode = "skirmish" | "colony" | "post-danger" | "boss"

export interface EnemyDef {
  kind: EnemyKind
  name: string
  hp: number
  damage: number
  /** Red-flag lesson this enemy teaches. */
  weakness: string
  xoeLine: string
  color: string
}

export interface FightEnemy {
  id: string
  kind: EnemyKind
  name: string
  hp: number
  maxHp: number
  x: number
  y: number
  damage: number
  weakness: string
  xoeLine: string
  color: string
  alive: boolean
}

export interface MechState {
  hp: number
  maxHp: number
  shield: number
  maxShield: number
  dodgeUntilMs: number
  fireCooldownUntilMs: number
}

export interface FightState {
  mode: FightMode
  difficulty: FightDifficulty
  mech: MechState
  enemies: FightEnemy[]
  score: number
  wave: number
  xoeTip: string
  won: boolean
  lost: boolean
  flashEnemyId: string | null
  flashMech: boolean
}

export interface FightScoreBoard {
  bestScore: number
  clears: number
  atMs: number
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  "phish-drone": {
    kind: "phish-drone",
    name: "Phish drone",
    hp: 40,
    damage: 8,
    weakness: "Urgency DM / lookalike link — never share a seed",
    xoeLine: "XO: Phish drones love haste. Tap them — cold vault stays safe.",
    color: "#ff6b7a",
  },
  "hack-probe": {
    kind: "hack-probe",
    name: "Hack probe",
    hp: 55,
    damage: 10,
    weakness: "Fake remote access / signature spam — don’t approve",
    xoeLine: "XO: Probes jab the mech link because the vault is cold.",
    color: "#7c5cff",
  },
  "scam-swarm": {
    kind: "scam-swarm",
    name: "Scam swarm",
    hp: 28,
    damage: 6,
    weakness: "Fake airdrop / ‘send to verify’ — ignore and block",
    xoeLine: "XO: Swarm wants a verify send. Blast them. Testnet XOE · no real money.",
    color: "#e4b15c",
  },
}

const DIFF_MULT: Record<FightDifficulty, { enemyHp: number; enemyDmg: number; mechHp: number }> = {
  easy: { enemyHp: 0.75, enemyDmg: 0.7, mechHp: 1.25 },
  normal: { enemyHp: 1, enemyDmg: 1, mechHp: 1 },
  hard: { enemyHp: 1.35, enemyDmg: 1.4, mechHp: 0.85 },
}

export function readFightDifficulty(store: Store | null): FightDifficulty {
  if (!store) return "normal"
  try {
    const v = store.getItem(FIGHT_DIFFICULTY_KEY)
    if (v === "easy" || v === "normal" || v === "hard") return v
  } catch {
    /* ignore */
  }
  return "normal"
}

export function writeFightDifficulty(store: Store | null, d: FightDifficulty): boolean {
  if (!store) return false
  try {
    store.setItem(FIGHT_DIFFICULTY_KEY, d)
    return true
  } catch {
    return false
  }
}

export function readFightScores(store: Store | null): FightScoreBoard {
  const empty = { bestScore: 0, clears: 0, atMs: 0 }
  if (!store) return empty
  try {
    const raw = store.getItem(FIGHT_SCORE_KEY)
    if (!raw) return empty
    const p = JSON.parse(raw) as Partial<FightScoreBoard>
    return {
      bestScore: Math.max(0, Math.floor(Number(p.bestScore) || 0)),
      clears: Math.max(0, Math.floor(Number(p.clears) || 0)),
      atMs: typeof p.atMs === "number" ? p.atMs : 0,
    }
  } catch {
    return empty
  }
}

export function recordFightScore(store: Store | null, score: number): FightScoreBoard {
  const prev = readFightScores(store)
  const next: FightScoreBoard = {
    bestScore: Math.max(prev.bestScore, Math.max(0, Math.floor(score))),
    clears: prev.clears + 1,
    atMs: Date.now(),
  }
  if (store) {
    try {
      store.setItem(FIGHT_SCORE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return next
}

let _id = 0
function nid(prefix: string) {
  _id += 1
  return `${prefix}-${_id}`
}

export function createMech(difficulty: FightDifficulty): MechState {
  const m = DIFF_MULT[difficulty]
  const maxHp = Math.round(100 * m.mechHp)
  return {
    hp: maxHp,
    maxHp,
    shield: 40,
    maxShield: 40,
    dodgeUntilMs: 0,
    fireCooldownUntilMs: 0,
  }
}

export function spawnEnemy(
  kind: EnemyKind,
  difficulty: FightDifficulty,
  x: number,
  y: number,
): FightEnemy {
  const def = ENEMY_DEFS[kind]
  const m = DIFF_MULT[difficulty]
  const maxHp = Math.max(1, Math.round(def.hp * m.enemyHp))
  return {
    id: nid(kind),
    kind,
    name: def.name,
    hp: maxHp,
    maxHp,
    x,
    y,
    damage: Math.max(1, Math.round(def.damage * m.enemyDmg)),
    weakness: def.weakness,
    xoeLine: def.xoeLine,
    color: def.color,
    alive: true,
  }
}

export function startFight(
  mode: FightMode,
  difficulty: FightDifficulty = "normal",
): FightState {
  const enemies: FightEnemy[] =
    mode === "boss"
      ? [
          spawnEnemy("hack-probe", difficulty, 70, 40),
          spawnEnemy("phish-drone", difficulty, 50, 55),
          spawnEnemy("scam-swarm", difficulty, 80, 60),
          spawnEnemy("hack-probe", difficulty, 30, 35),
        ]
      : mode === "post-danger"
        ? [spawnEnemy("hack-probe", difficulty, 65, 45), spawnEnemy("phish-drone", difficulty, 40, 60)]
        : [
            spawnEnemy("phish-drone", difficulty, 60, 40),
            spawnEnemy("scam-swarm", difficulty, 75, 55),
            spawnEnemy("hack-probe", difficulty, 35, 50),
          ]
  return {
    mode,
    difficulty,
    mech: createMech(difficulty),
    enemies,
    score: 0,
    wave: 1,
    xoeTip:
      mode === "boss"
        ? "XO: Ragnarok sends everything. Tap foes, hold to auto-fire, dodge with shield."
        : "XO: They attack the mech because the vault is cold. Tap to aim and fire.",
    won: false,
    lost: false,
    flashEnemyId: null,
    flashMech: false,
  }
}

export const PLAYER_SHOT_DAMAGE = 14
export const FIRE_COOLDOWN_MS = 180
export const DODGE_MS = 700
export const DODGE_COOLDOWN_MS = 2200

export function canFire(fight: FightState, nowMs: number): boolean {
  return !fight.won && !fight.lost && nowMs >= fight.mech.fireCooldownUntilMs
}

export function canDodge(fight: FightState, nowMs: number): boolean {
  return !fight.won && !fight.lost && nowMs >= fight.mech.dodgeUntilMs + (DODGE_COOLDOWN_MS - DODGE_MS)
}

/** Tap/click enemy (or fire at nearest). Returns updated state. */
export function playerFire(
  fight: FightState,
  nowMs: number,
  targetId: string | null,
): FightState {
  if (!canFire(fight, nowMs)) return { ...fight, flashEnemyId: null, flashMech: false }
  const alive = fight.enemies.filter((e) => e.alive)
  if (!alive.length) return fight
  let target = targetId ? alive.find((e) => e.id === targetId) : null
  if (!target) target = alive[0]!
  const hp = Math.max(0, target.hp - PLAYER_SHOT_DAMAGE)
  const killed = hp <= 0
  const enemies = fight.enemies.map((e) =>
    e.id === target!.id ? { ...e, hp, alive: !killed } : e,
  )
  const score = fight.score + (killed ? 50 : 10)
  const remaining = enemies.some((e) => e.alive)
  return {
    ...fight,
    enemies,
    score,
    mech: { ...fight.mech, fireCooldownUntilMs: nowMs + FIRE_COOLDOWN_MS },
    xoeTip: killed ? target.xoeLine : `XO: Hit ${target.name}. Weakness: ${target.weakness}`,
    flashEnemyId: target.id,
    flashMech: false,
    won: !remaining,
    lost: false,
  }
}

export function playerDodge(fight: FightState, nowMs: number): FightState {
  if (!canDodge(fight, nowMs)) return fight
  return {
    ...fight,
    mech: {
      ...fight.mech,
      dodgeUntilMs: nowMs + DODGE_MS,
      shield: Math.min(fight.mech.maxShield, fight.mech.shield + 8),
    },
    xoeTip: "XO: Shield pulse — dodging.",
    flashEnemyId: null,
    flashMech: false,
  }
}

/** Enemy tick: living foes deal damage unless dodging. */
export function enemyTick(fight: FightState, nowMs: number): FightState {
  if (fight.won || fight.lost) return fight
  const dodging = nowMs < fight.mech.dodgeUntilMs
  if (dodging) return { ...fight, flashEnemyId: null, flashMech: false }
  const living = fight.enemies.filter((e) => e.alive)
  if (!living.length) return { ...fight, won: true }
  // Aggregate a soft hit from up to 1 foe per tick (caller paces ticks)
  const foe = living[Math.floor(nowMs / 1000) % living.length]!
  let shield = fight.mech.shield
  let hp = fight.mech.hp
  let dmg = foe.damage
  if (shield > 0) {
    const absorb = Math.min(shield, dmg)
    shield -= absorb
    dmg -= absorb
  }
  hp = Math.max(0, hp - dmg)
  return {
    ...fight,
    mech: { ...fight.mech, hp, shield },
    flashMech: dmg > 0 || fight.mech.shield !== shield,
    flashEnemyId: null,
    lost: hp <= 0,
    xoeTip: hp <= 0 ? "XO: Mech down — testnet reset. Vault still cold." : fight.xoeTip,
  }
}

export function applyDamageToMech(fight: FightState, amount: number): FightState {
  let shield = fight.mech.shield
  let dmg = Math.max(0, amount)
  if (shield > 0) {
    const absorb = Math.min(shield, dmg)
    shield -= absorb
    dmg -= absorb
  }
  const hp = Math.max(0, fight.mech.hp - dmg)
  return {
    ...fight,
    mech: { ...fight.mech, hp, shield },
    lost: hp <= 0,
    flashMech: true,
  }
}

/* ---------- v15: ticker in fights (Testnet XOE · no real money) ----------
 * Every few seconds the ticker drops one tick onto the fight field:
 *   green ▲ energy cell  — tap it: +shield (and a few points). Ignored → it fades, no harm.
 *   red ▼ hazard surge   — tap it to defuse (+points), Dodge to avoid it; else it hits the mech when the fuse ends.
 * Direction comes from the coin's last price move (rotating through the ticker coins).
 */
export type FightTickKind = "energy" | "surge"
export interface FightTick {
  id: string
  kind: FightTickKind
  symbol: string
  big: boolean
  x: number
  y: number
  bornAt: number
  fuseMs: number
}
export const FIGHT_TICK_EVERY_MS = 5_000
export const FIGHT_TICK_FUSE_MS = 3_500
export const FIGHT_ENERGY_SHIELD = 12
export const FIGHT_SURGE_DAMAGE = 8
export const FIGHT_TICK_POINTS = 5

/** Pure: build the next tick. `stepPct` = that coin's last move (null/0 → alternate energy/surge). */
export function makeFightTick(symbol: string, stepPct: number | null | undefined, seq: number, nowMs: number, reduced = false): FightTick {
  const up = stepPct == null || stepPct === 0 ? seq % 2 === 0 : stepPct > 0
  return {
    id: `ft-${seq}-${nowMs}`,
    kind: up ? "energy" : "surge",
    symbol,
    big: Math.abs(stepPct ?? 0) >= 0.15,
    x: 30 + ((seq * 37) % 50),
    y: 18 + ((seq * 23) % 40),
    bornAt: nowMs,
    fuseMs: reduced ? FIGHT_TICK_FUSE_MS + 1500 : FIGHT_TICK_FUSE_MS,
  }
}

/** Player taps a tick: energy → shield, surge → defused. Both give a few arcade points. */
export function tapFightTick(fight: FightState, tick: FightTick): FightState {
  if (fight.won || fight.lost) return fight
  const mult = tick.big ? 2 : 1
  const shield =
    tick.kind === "energy" ? Math.min(fight.mech.maxShield, fight.mech.shield + FIGHT_ENERGY_SHIELD * mult) : fight.mech.shield
  return {
    ...fight,
    mech: { ...fight.mech, shield },
    score: fight.score + FIGHT_TICK_POINTS * mult,
    xoeTip:
      tick.kind === "energy"
        ? `XO: ${tick.symbol} ticked up — shield +${FIGHT_ENERGY_SHIELD * mult}.`
        : `XO: ${tick.symbol} dip surge defused. Stay calm in a dip.`,
    flashEnemyId: null,
    flashMech: false,
  }
}

/** Fuse ran out: a surge hits (dodging blocks it, difficulty scales it); energy just fades. */
export function expireFightTick(fight: FightState, tick: FightTick, nowMs: number): FightState {
  if (fight.won || fight.lost || tick.kind === "energy") return fight
  if (nowMs < fight.mech.dodgeUntilMs) return { ...fight, xoeTip: `XO: Dodged the ${tick.symbol} surge.` }
  const dmg = Math.round(FIGHT_SURGE_DAMAGE * (tick.big ? 2 : 1) * DIFF_MULT[fight.difficulty].enemyDmg)
  const next = applyDamageToMech(fight, dmg)
  return { ...next, xoeTip: next.lost ? "XO: Mech down — testnet reset. Vault still cold." : `XO: ${tick.symbol} surge hit. Tap red ticks or dodge.` }
}
