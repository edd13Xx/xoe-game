import { XO_CLASS_LINE, XO_PROFILE_LINE, XO_STATS_CLASSIFIED } from "../game/companion-display.ts"
import { useEffect, useState } from "react"
import { FounderBadge } from "./FounderBadge.tsx"
import { hasFounderBadge } from "../game/reward-plan.ts"
import {
  XOE_COIN_CAP,
  XOE_ENERGY_MAX,
  claimDailyBonus,
  canClaimDailyBonus,
  readLeaderboard,
  readMeta,
  settleRunCoins,
  writeMeta,
  type MetaProgress,
  type PersonalBestRun,
  type ReturnBreakdown,
} from "../game/meta-progress.ts"
import { classCombatStats, statsAtLevel } from "../game/class-stats.ts"
import { maybeShopPurchaseLine } from "../game/shop-lines.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import { getLocalStore } from "../game/safe-storage.ts"

function store() {
  return getLocalStore()
}

/**
 * Upgrade / stats panel — NO + buttons.
 * Stats rise automatically on level up (count-up + glow).
 */
export function UpgradeMenu({ xoPilot = false }: { xoPilot?: boolean } = {}) {
  const [meta, setMeta] = useState<MetaProgress>(() => readMeta(null))
  const [board, setBoard] = useState<PersonalBestRun[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [lastReturn, setLastReturn] = useState<ReturnBreakdown | null>(null)
  const [glow, setGlow] = useState(false)
  const [displayDef, setDisplayDef] = useState(0)
  const [displayOff, setDisplayOff] = useState(0)
  const [displayHp, setDisplayHp] = useState(0)

  useEffect(() => {
    const m = readMeta(store())
    setMeta(m)
    setBoard(readLeaderboard(store()))
    const s = statsAtLevel(m.pilotClass, m.level)
    setDisplayDef(s.def)
    setDisplayOff(s.off)
    setDisplayHp(s.maxHealth)
  }, [])

  /** Animate count-up when level changes (e.g. after practice return). */
  function animateToLevel(next: MetaProgress) {
    const from = statsAtLevel(next.pilotClass, Math.max(1, next.level - (next.level > 1 ? 1 : 0)))
    const to = statsAtLevel(next.pilotClass, next.level)
    setGlow(true)
    const steps = 12
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      const t = i / steps
      setDisplayDef(Math.round((from.def + (to.def - from.def) * t) * 10) / 10)
      setDisplayOff(Math.round((from.off + (to.off - from.off) * t) * 10) / 10)
      setDisplayHp(Math.round(from.maxHealth + (to.maxHealth - from.maxHealth) * t))
      if (i >= steps) {
        window.clearInterval(id)
        setDisplayDef(to.def)
        setDisplayOff(to.off)
        setDisplayHp(to.maxHealth)
        window.setTimeout(() => setGlow(false), 600)
      }
    }, 40)
  }



  function onDaily() {
    const next = claimDailyBonus(meta, store())
    if (!next) {
      setNote("Daily practice already claimed today.")
      return
    }
    setMeta(next)
    const line = maybeShopPurchaseLine(Date.now(), true)
    if (line) void xoSpeak(line)
    setNote(line ? `${line} Daily bonus added.` : "Daily bonus added.")
  }

  const row = classCombatStats(meta.pilotClass)

  return (
    <section className="panel upgrade-menu" aria-label="Stats and upgrades">
      <h2>Pilot stats</h2>
      <p className="fine">
        Stats rise automatically when you level up — no manual + points. Pocket {meta.coins}/{XOE_COIN_CAP}. Vault{" "}
        {meta.vault}. Energy {meta.energy}/{XOE_ENERGY_MAX}. XP {meta.xp} · Lv {meta.level}.
      </p>
      {lastReturn ? (
        <p className="return-breakdown" role="status">
          Return: {lastReturn.summary}
          {lastReturn.leveledUp ? ` · Level up → ${lastReturn.newLevel}` : ""}
        </p>
      ) : null}
      <div className={`stat-card-grid auto-stats${glow ? " glow" : ""}`} role="list">
        {xoPilot ? (
          // v18.2 (Eddie): XO is a state-of-the-art unknown orbital — her class and stats are classified.
          <article className="stat-card xo-classified-card" role="listitem">
            <strong>XO</strong>
            <p className="fine">{XO_CLASS_LINE}</p>
            <p>{XO_STATS_CLASSIFIED}</p>
            <p className="fine">{XO_PROFILE_LINE}</p>
          </article>
        ) : (
          <>
            <article className="stat-card" role="listitem">
              <strong>{meta.pilotClass}</strong>
              <p className="fine">{row.blurb}</p>
              <p className={glow ? "stat-countup" : undefined}>DEF {displayDef}</p>
              <p className={glow ? "stat-countup" : undefined}>OFF {displayOff}</p>
              <p className={glow ? "stat-countup" : undefined}>Max HP {displayHp}</p>
            </article>
            <article className="stat-card" role="listitem">
              <strong>Auto growth</strong>
              <p className="fine">On level up, DEF/OFF/HP count up with a glow. No + buttons.</p>
              <p className="fine">
                Next: DEF +{row.defGrowth} · OFF +{row.offGrowth} · HP +{row.healthGrowth}
              </p>
            </article>
          </>
        )}
      </div>
      <p className="fine">Vault coins are spendable in the Shop for health items.</p>
      <button type="button" className="touch-btn primary" disabled={!canClaimDailyBonus(store())} onClick={onDaily}>
        Daily practice
      </button>
      <button
        type="button"
        className="touch-btn ghost"
        onClick={() => {
          // Force a level-up path for demo: low XP remaining
          const m = { ...meta, energy: 100, xp: 95 }
          const settled = settleRunCoins(m, 20)
          writeMeta(store(), settled.meta)
          setMeta(settled.meta)
          setLastReturn(settled.breakdown)
          setNote(settled.breakdown.summary)
          if (settled.breakdown.leveledUp) animateToLevel(settled.meta)
        }}
      >
        Practice return split (demo)
      </button>
      {note ? <p role="status">{note}</p> : null}
      <h3>Local personal bests</h3>
      <p className="fine">On this device only.</p>
      <ol className="local-leaderboard">
        {board.length === 0 ? <li className="fine">No runs saved yet.</li> : null}
        {board.map((row, i) => (
          <li key={`${row.atMs}-${i}`}>
            #{i + 1} {hasFounderBadge() ? <FounderBadge small /> : null} · {row.score} run pts
          </li>
        ))}
      </ol>
    </section>
  )
}
