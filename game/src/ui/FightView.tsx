import { resumeFightClock } from "../game/fight-pause.ts"
import { PERSONA_LINES } from "../game/persona-lines.ts"
import { FightXo } from "./FightXo.tsx"
import { FightEnemySprite } from "./FightEnemySprite.tsx"
import {
  XO_ANCHOR,
  beamLine,
  dashAfterimages,
  dashReadyFrac,
  dashSpeedLines,
  enemyHpPct,
  enemyHpTone,
  isDoubleTap,
  radarBlips,
  swipeDashDir,
  xoCondition,
  DASH_TRAVEL_PX,
  type DashDir,
  type PointerMark,
} from "../game/fight-visuals.ts"
import { recordEarn, recordTradePnl, readLedger } from "../game/reward-plan.ts"
import { useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { TickerContext, xoePriceFromSnap } from "./useTickerFeed.ts"
import {
  applyPaperAction,
  applyPracticeTick,
  canBuy,
  canSell,
  initialPractice,
  paperResult,
  paperResultStroops,
  type PracticeState,
} from "../game/practice.ts"
import { formatXoe7 } from "../game/economy.ts"
import { FightTradeStrip } from "./PracticeView.tsx"
import { TICKER_SYMBOLS } from "../game/live-ticker.ts"
import {
  DODGE_COOLDOWN_MS,
  DODGE_MS,
  FIGHT_TICK_EVERY_MS,
  canDodge,
  enemyTick,
  expireFightTick,
  makeFightTick,
  tapFightTick,
  type FightTick,
  playerDodge,
  playerFire,
  recordFightScore,
  startFight,
  type FightMode,
  type FightState,
  readFightDifficulty,
} from "../game/combat.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { hapticPulse } from "../game/haptics.ts"
import { usePrefersReducedMotion } from "./runtime.ts"
import { prefersTouchPrimary } from "../game/controls.ts"

const FIELD_H = 220

export function FightView({
  mode = "skirmish",
  onDone,
  autoStart = true,
  paused = false,
  sharedDesk,
  onSharedDesk,
}: {
  mode?: FightMode
  onDone?: (result: { won: boolean; score: number }) => void
  sharedDesk?: PracticeState
  onSharedDesk?: Dispatch<SetStateAction<PracticeState>>
  paused?: boolean
  autoStart?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const touch = prefersTouchPrimary()
  const [fight, setFight] = useState<FightState | null>(null)
  const holding = useRef(false)
  const attackClock = useRef({ enemy: 0, fire: 0 })
  const holdTarget = useRef<string | null>(null)
  const doneSent = useRef(false)
  const [round, setRound] = useState(0)
  // v15: ticker in fights — green ▲ energy (tap: shield), red ▼ surge (tap to defuse or Dodge).
  const snap = useContext(TickerContext)
  const snapRef = useRef(snap)
  snapRef.current = snap
  const [ticks, setTicksState] = useState<FightTick[]>([])
  const ticksRef = useRef<FightTick[]>([])
  const setTicks = (next: FightTick[]) => {
    ticksRef.current = next
    setTicksState(next)
  }
  const [localDesk, setLocalDesk] = useState(() =>
    initialPractice({ unclaimedStroops: readLedger(getLocalStore()).unclaimed, price: 10 }),
  )
  const desk = sharedDesk ?? localDesk
  const setDesk = onSharedDesk ?? setLocalDesk
  const settledTrade = useRef(false)
  // ZOE-style boost dash: visual lunge + afterimages on top of the existing Dodge (same timing, no new game numbers).
  const fightRef = useRef<FightState | null>(null)
  useEffect(() => { fightRef.current = fight }, [fight])
  const [dash, setDash] = useState<{ key: number; dir: DashDir; active: boolean } | null>(null)
  const dashTimer = useRef<number | null>(null)
  const lastTap = useRef<PointerMark | null>(null)
  const swipeStart = useRef<PointerMark | null>(null)
  useEffect(() => () => { if (dashTimer.current != null) window.clearTimeout(dashTimer.current) }, [])

  useEffect(() => {
    if (!autoStart) return
    setFight(startFight(mode, readFightDifficulty(getLocalStore())))
    setTicks([])
    doneSent.current = false
    settledTrade.current = false
    attackClock.current = { enemy: 0, fire: 0 }
    if (!sharedDesk) setDesk(initialPractice({ unclaimedStroops: readLedger(getLocalStore()).unclaimed, price: xoePriceFromSnap(snapRef.current) ?? 10 }))
  }, [mode, autoStart, round])

  const pausedAt = useRef<number | null>(null)
  useEffect(() => {
    holding.current = false
    if (paused) { pausedAt.current = Date.now(); return }
    if (pausedAt.current != null) {
      const elapsed = Date.now() - pausedAt.current
      attackClock.current.enemy += elapsed
      attackClock.current.fire += elapsed
      setFight((f) => f ? resumeFightClock(f, elapsed) : f)
      setTicks(ticksRef.current.map((t) => ({ ...t, bornAt: t.bornAt + elapsed })))
      pausedAt.current = null
    }
  }, [paused])
  const over = !fight || fight.won || fight.lost
  const xoePx = xoePriceFromSnap(snap) ?? desk.price
  useEffect(() => {
    if (paused || over) return
    setDesk((d) => applyPracticeTick(d, xoePx))
  }, [xoePx, over, paused])
  useEffect(() => {
    if (!fight || !(fight.won || fight.lost) || settledTrade.current) return
    settledTrade.current = true
    const pnl = paperResultStroops(desk, xoePx)
    if (!sharedDesk && pnl !== 0) recordTradePnl(getLocalStore(), pnl)
  }, [fight, desk, xoePx])
  useEffect(() => {
    if (paused) return
    if (over) {
      setTicks([])
      return
    }
    let seq = 0
    const every = reduced ? FIGHT_TICK_EVERY_MS + 1500 : FIGHT_TICK_EVERY_MS
    let last = Date.now() - every + 1500 // first tick ~1.5s in
    const id = window.setInterval(() => {
      const now = Date.now()
      let add: FightTick | null = null
      if (now - last >= every) {
        last = now
        const quotes = snapRef.current?.quotes ?? []
        const q = quotes.length ? quotes[seq % quotes.length]! : null
        add = makeFightTick(q?.symbol ?? TICKER_SYMBOLS[seq % TICKER_SYMBOLS.length]!, q?.stepPct, seq, now, reduced)
        seq += 1
      }
      const cur = ticksRef.current
      const gone = cur.filter((t) => now - t.bornAt >= t.fuseMs)
      if (gone.length) setFight((f) => gone.reduce((g, t) => (g ? expireFightTick(g, t, now) : g), f))
      if (gone.length || add) {
        const next = [...cur.filter((t) => !gone.includes(t)), ...(add ? [add] : [])].slice(-2)
        ticksRef.current = next
        setTicks(next)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [over, reduced, paused])

  const tapTick = (t: FightTick) => {
    if (paused || !ticksRef.current.some((x) => x.id === t.id)) return
    setTicks(ticksRef.current.filter((x) => x.id !== t.id))
    setFight((f) => (f ? tapFightTick(f, t) : f))
    hapticPulse(getLocalStore(), 10)
  }

  useEffect(() => {
    if (paused || !fight || fight.won || fight.lost) return
    let alive = true
    const clock = attackClock.current
    const tickMs = reduced ? 1200 : 900
    const fireMs = 200
    const loop = (t: number) => {
      if (!alive) return
      if (t - clock.enemy >= tickMs) {
        clock.enemy = t
        setFight((f) => (f && !f.won && !f.lost ? enemyTick(f, Date.now()) : f))
      }
      if (holding.current && t - clock.fire >= fireMs) {
        clock.fire = t
        setFight((f) => {
          if (!f || f.won || f.lost) return f
          const next = playerFire(f, Date.now(), holdTarget.current)
          if (next.flashEnemyId) hapticPulse(getLocalStore(), 12)
          return next
        })
      }
      raf = requestAnimationFrame(loop)
    }
    let raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [fight?.won, fight?.lost, reduced, paused])

  useEffect(() => {
    if (!fight) return
    if ((fight.won || fight.lost) && !doneSent.current) {
      doneSent.current = true
      if (fight.won) {
        recordFightScore(getLocalStore(), fight.score)
        recordEarn(getLocalStore(), "fight_win")
      }
      onDone?.({ won: fight.won, score: fight.score })
    }
  }, [fight?.won, fight?.lost, fight?.score, onDone])

  const fireAt = useCallback((id: string | null) => {
    setFight((f) => {
      if (!f) return f
      const next = playerFire(f, Date.now(), id)
      if (next.flashEnemyId) hapticPulse(getLocalStore(), 12)
      return next
    })
  }, [])

  const dodge = useCallback((dir: DashDir = 1) => {
    const f = fightRef.current
    if (!f || !canDodge(f, Date.now())) return
    setFight((cur) => (cur ? playerDodge(cur, Date.now()) : cur))
    setDash((d) => ({ key: (d?.key ?? 0) + 1, dir, active: true }))
    if (dashTimer.current != null) window.clearTimeout(dashTimer.current)
    dashTimer.current = window.setTimeout(() => setDash((d) => (d ? { ...d, active: false } : d)), DODGE_MS)
    hapticPulse(getLocalStore(), 8)
  }, [])

  useEffect(() => {
    if (paused || touch) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && (target.closest("input, textarea, select, [contenteditable=true]") || target.closest("button"))) return
      if (e.code === "Space") {
        e.preventDefault()
        fireAt(holdTarget.current)
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault()
        dodge()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [touch, fireAt, dodge, paused])

  if (!fight) return null
  const now = Date.now()
  const dashing = !!dash?.active
  const dashReady = canDodge(fight, now)
  const dashFrac = dashReadyFrac(fight.mech.dodgeUntilMs, now, DODGE_MS, DODGE_COOLDOWN_MS)
  const cond = xoCondition(fight.mech.hp, fight.mech.maxHp)
  const blips = radarBlips(fight.enemies)
  const ghosts = dashing ? dashAfterimages(reduced) : []
  const speedLines = dashing ? dashSpeedLines(dash!.key, reduced) : []

  return (
    <section className="fight-view panel" data-fight={fight.mode} aria-label="Combat">
      <p className="fine">
        Fight · {fight.mode} · {fight.difficulty} · pts · testnet · no real money
      </p>
      <div className="fight-hud">
        <div className="barwrap" title="Hull">
          <div className={`bar${fight.flashMech && !reduced ? " gate-flash" : ""}`} style={{ width: `${(fight.mech.hp / fight.mech.maxHp) * 100}%` }} />
        </div>
        <p className="fine">
          Hull {fight.mech.hp}/{fight.mech.maxHp} · Shield {fight.mech.shield} · Score {fight.score}
          {fight.flashEnemyId ? " · Hit" : fight.flashMech ? " · Impact" : ""}
        </p>
        <p className={`fine xo-condition cond-${cond.tone}`} data-condition={cond.tone}>
          <span className="xo-condition-dot" aria-hidden="true" /> Condition {cond.label}
        </p>
        <svg className="fight-radar" data-blips={blips.length} viewBox="0 0 100 100" role="img" aria-label={`Ring radar: ${blips.length} contact${blips.length === 1 ? "" : "s"}${blips.some((b) => b.near) ? ", one close" : ""}`}>
          <circle cx="50" cy="50" r="44" className="radar-ring" />
          <circle cx="50" cy="50" r="24" className="radar-ring inner" />
          <line x1="50" y1="6" x2="50" y2="94" className="radar-axis" />
          <line x1="6" y1="50" x2="94" y2="50" className="radar-axis" />
          <circle cx="50" cy="50" r="4" className="radar-self" style={{ fill: cond.color }} />
          {blips.map((b) => (
            <circle key={b.id} cx={b.x} cy={b.y} r={b.near ? 5 : 4} className={`radar-blip${b.near ? " is-near" : ""}`} data-blip={b.id} />
          ))}
        </svg>
      </div>
      <p className="bubble fight-tip">{fight.xoeTip}</p>
      <div
        className={`fight-field arcade-field zoe-field${fight.flashMech && !reduced ? " is-hit" : ""}${fight.flashEnemyId && !reduced ? " is-firing" : ""}${fight.mech.shield > 0 ? " is-shielded" : ""}${dashing ? " is-dashing" : ""}`}
        data-dashing={dashing ? "1" : "0"}
        style={{ height: FIELD_H }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".fight-enemy")) return
          const mark = { x: e.clientX, y: e.clientY, t: performance.now() }
          swipeStart.current = mark
          if (isDoubleTap(lastTap.current, mark)) {
            lastTap.current = null
            dodge(1)
          } else lastTap.current = mark
          holding.current = true
          holdTarget.current = null
          fireAt(null)
        }}
        onPointerCancel={() => { holding.current = false }}
        onPointerUp={(e) => {
          holding.current = false
          const dir = swipeDashDir(swipeStart.current, { x: e.clientX, y: e.clientY, t: performance.now() })
          swipeStart.current = null
          if (dir) { lastTap.current = null; dodge(dir) }
        }}
        onPointerLeave={() => {
          holding.current = false
        }}
      >
        {ticks.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`fight-tick tick-${t.kind}${t.big ? " big" : ""}`}
            data-fight-tick={t.kind}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            aria-label={t.kind === "energy" ? `${t.symbol} up: energy, tap for shield` : `${t.symbol} down: surge, tap to defuse`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); tapTick(t) }}
          >
            {t.kind === "energy" ? "▲" : "▼"} {t.symbol}
          </button>
        ))}
        {(() => {
          const target = !reduced && fight.flashEnemyId ? fight.enemies.find((e) => e.id === fight.flashEnemyId && e.alive) : undefined
          if (!target) return null
          const b = beamLine(target)
          return (
            <svg className="fight-beam" data-fight-beam={target.id} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} className="fight-beam-glow" vectorEffect="non-scaling-stroke" />
              <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} className="fight-beam-core" vectorEffect="non-scaling-stroke" />
            </svg>
          )
        })()}
        {fight.enemies.map((en) => {
          if (!en.alive) return null
          const pct = enemyHpPct(en.hp, en.maxHp)
          const locked = fight.flashEnemyId === en.id && !reduced
          return (
            <button
              key={en.id}
              type="button"
              className={`fight-enemy fight-enemy-ship${locked ? " gate-flash is-locked" : ""}`}
              data-enemy-kind={en.kind}
              style={{
                left: `${en.x}%`,
                top: `${en.y}%`,
                ["--enemy-color" as string]: en.color,
                minWidth: 48,
                minHeight: 48,
              }}
              title={`Fire at ${en.name}`}
              onPointerDown={(e) => {
                e.stopPropagation()
                holding.current = true
                holdTarget.current = en.id
                fireAt(en.id)
              }}
              onClick={(e) => { if (e.detail === 0) fireAt(en.id) }}
              onPointerCancel={() => { holding.current = false }}
              onLostPointerCapture={() => { holding.current = false }}
              onPointerUp={() => {
                holding.current = false
              }}
            >
              {locked ? <span className="fight-impact" aria-hidden="true" /> : null}
              {locked ? <span className="fight-reticle" aria-hidden="true" /> : null}
              <FightEnemySprite kind={en.kind} color={en.color} />
              <span className="fight-enemy-name"><span className="sr-only">Fire at </span>{en.name}</span>
              <span className={`fight-enemy-hp hp-${enemyHpTone(pct)}`} aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="sr-only"> hull </span>
              <span className="fine fight-enemy-hp-text">
                {en.hp}/{en.maxHp}
              </span>
            </button>
          )
        })}
        {speedLines.length ? (
          <div className="dash-speedlines" key={`sl-${dash!.key}`} aria-hidden="true" data-dash-fx="speedlines">
            {speedLines.map((l, i) => (
              <span key={i} style={{ top: `${l.top}%`, width: `${l.len}%`, animationDelay: `${l.delayMs}ms`, ["--dash-dir" as string]: dash!.dir }} />
            ))}
          </div>
        ) : null}
        <div
          className={`fight-mech fight-xo${reduced ? " is-reduced" : ""}`}
          style={{ left: `${XO_ANCHOR.x}%`, top: `${XO_ANCHOR.y}%`, ["--dash-dir" as string]: dash?.dir ?? 1, ["--dash-px" as string]: `${DASH_TRAVEL_PX}px`, ["--dash-ms" as string]: `${DODGE_MS}ms` }}
        >
          {ghosts.map((g) => (
            <span
              key={`g-${dash!.key}-${g.i}`}
              className="xo-afterimage"
              data-dash-fx="afterimage"
              aria-hidden="true"
              style={{ animationDelay: `${g.delayMs}ms`, ["--ghost-op" as string]: g.opacity }}
            />
          ))}
          <div className={`xo-dash-body${dashing ? " is-dashing" : ""}`} key={`b-${dash?.key ?? 0}`}>
            {dashing && !reduced ? <span className="xo-thruster-flare" data-dash-fx="flare" aria-hidden="true" /> : null}
            <FightXo hp={fight.mech.hp} maxHp={fight.mech.maxHp} shield={fight.mech.shield} reduced={reduced} />
          </div>
        </div>
      </div>
      <div className="menu-row">
        <button type="button" className="touch-btn primary" onClick={() => fireAt(null)}>
          Fire
        </button>
        <button
          type="button"
          className={`touch-btn dash-btn${dashReady ? " is-ready" : ""}`}
          disabled={!dashReady}
          aria-label="Dash / Shield (boost dash, dodge)"
          data-dash-ready={dashReady ? "1" : "0"}
          onClick={() => dodge(1)}
        >
          <svg className="dash-ring" viewBox="0 0 36 36" width="22" height="22" aria-hidden="true" focusable="false">
            <circle className="dash-ring-track" cx="18" cy="18" r="15" pathLength={100} />
            <circle
              key={`r-${dash?.key ?? 0}`}
              className={`dash-ring-fill${dash && !dashReady ? " is-cooling" : ""}`}
              cx="18"
              cy="18"
              r="15"
              pathLength={100}
              style={{ strokeDashoffset: dash && !dashReady ? undefined : 100 - dashFrac * 100, ["--cd-ms" as string]: `${DODGE_COOLDOWN_MS}ms` }}
            />
          </svg>
          Dash / Shield
        </button>
      </div>
      {!touch ? <p className="fine">Computer: Space fire · Shift boost dash</p> : <p className="fine">Hold enemy to lock on and auto-fire · double-tap or swipe the field to dash</p>}
      <FightTradeStrip
        price={xoePx}
        canBuyNow={!over && canBuy(desk, xoePx)}
        canSellNow={!over && canSell(desk, xoePx)}
        pnlUsd={paperResult(desk, xoePx)}
        pnlPlay={formatXoe7(paperResultStroops(desk, xoePx), true)}
        onBuy={() => setDesk((d) => applyPaperAction(d, "buy", xoePx))}
        onSell={() => setDesk((d) => applyPaperAction(d, "sell", xoePx))}
      />
      <p className="fine fight-ticker-hint">Ticker: tap green ▲ for shield · tap red ▼ (or Dodge) before it hits</p>
      {fight.won ? <p className="ok">{PERSONA_LINES["fight.win"]} · +{fight.score} pts (device)</p> : null}
      {fight.lost ? <p className="bad">{PERSONA_LINES["fight.lose"]} Vault still cold · testnet</p> : null}
      {fight.won || fight.lost ? (
        <button type="button" className="touch-btn" onClick={() => setRound((r) => r + 1)}>
          {fight.lost ? "Try again" : "Fight again"}
        </button>
      ) : null}
    </section>
  )
}
