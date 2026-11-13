import { useEffect, useRef, useState } from "react"
import { rsi14, rsiBand, formatRsi, priceVolatility } from "../game/rsi.ts"
import {
  ARENA_H,
  ARENA_W,
  SHIELD_MAX,
  SHIP_X,
  XOE_X,
  XOE_Y,
  createArena,
  tickArena,
  applyTradeImpulse,
  toggleArenaEased,
  toggleArenaPaused,
  type ArenaDifficulty,
  type TradeImpulse,
} from "../game/trade-sim-arena.ts"
import { flareController } from "../game/flare-bus.ts"
import type { SnlSide } from "../game/snl-listing.ts"
import { XOE_SIM_LABEL, XOE_SIM_SAFETY, formatXoeTickPrice } from "../game/xoe-sim-price.ts"
import { XoeMechPortrait } from "./XoeMechPortrait.tsx"
import { useDocumentHidden } from "./runtime.ts"

/**
 * One interactive price-driven sim for the paper/practice trade desk:
 * the ship is the XOE/USD tick, bot attackers close in, XOE's mech and the
 * ship fire original energy lasers. Trading controls stay outside this arena.
 */
export function TradeSimArena({
  price,
  history,
  difficulty = "normal",
  reducedMotion = false,
  forcePaused = false,
  tradeImpulse = null,
  tradeSeq = 0,
  positionSide = "flat",
}: {
  price: number
  history: readonly number[]
  difficulty?: ArenaDifficulty
  reducedMotion?: boolean
  forcePaused?: boolean
  tradeImpulse?: TradeImpulse | null
  tradeSeq?: number
  positionSide?: SnlSide
}) {
  const hidden = useDocumentHidden()
  const [state, setState] = useState(() => createArena(price, reducedMotion))
  const [firing, setFiring] = useState(false)
  const fireShip = useRef(false)
  const fireXoe = useRef(false)
  const dash = useRef(false)
  const priceRef = useRef(price)
  const historyRef = useRef(history)
  const diffRef = useRef(difficulty)
  const reducedRef = useRef(reducedMotion)
  const holdRef = useRef(forcePaused)
  const seqRef = useRef(0)
  const impulseRef = useRef<TradeImpulse | null>(null)
  const rsi = rsi14(history)
  const band = rsiBand(rsi)
  const vol = priceVolatility(history)

  useEffect(() => {
    priceRef.current = price
    historyRef.current = history
    diffRef.current = difficulty
    reducedRef.current = reducedMotion
    holdRef.current = forcePaused
    if (tradeSeq !== seqRef.current) {
      seqRef.current = tradeSeq
      impulseRef.current = tradeImpulse
    }
  }, [price, history, difficulty, reducedMotion, forcePaused, tradeSeq, tradeImpulse])

  useEffect(() => {
    if (hidden || forcePaused) {
      fireShip.current = false
      fireXoe.current = false
      dash.current = false
      return
    }
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const ship = fireShip.current
      const xoe = fireXoe.current
      const dashing = dash.current
      fireShip.current = false
      fireXoe.current = false
      dash.current = false
      setState((s) => {
        const impulse = impulseRef.current
        impulseRef.current = null
        const ticked = tickArena({ ...s, paused: s.paused || holdRef.current }, dt, {
          price: priceRef.current,
          history: historyRef.current,
          difficulty: diffRef.current,
          reducedMotion: reducedRef.current,
          fireShip: ship,
          fireXoe: xoe,
          dash: dashing,
          redDay: flareController()?.peek().active === true,
        })
        const next = impulse ? applyTradeImpulse(ticked, impulse) : ticked
        if (
          next.shipY === s.shipY &&
          next.bounce === s.bounce &&
          next.shield === s.shield &&
          next.flash === s.flash &&
          next.spawnIn === s.spawnIn &&
          next.enemies === s.enemies &&
          next.shots === s.shots &&
          next.lockId === s.lockId &&
          next.paused === s.paused &&
          next.tradeKick === s.tradeKick
        ) {
          return s
        }
        return next
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [hidden, forcePaused])

  const shoot = () => {
    fireShip.current = true
    fireXoe.current = true
    setFiring(true)
    window.setTimeout(() => setFiring(false), 180)
  }

  return (
    <div className="trade-sim-arena" data-paused={state.paused ? "1" : "0"}>
      <div className="trade-sim-head">
        <div className={`rsi-box rsi-${band}`} data-rsi-box="1" aria-label={`Simulated RSI 14 ${formatRsi(rsi)}`}>
          <span className="rsi-label">RSI(14) sim</span>
          <strong>{formatRsi(rsi)}</strong>
          <span className="fine">{band === "warming" ? "warming up" : band}</span>
        </div>
        <div className="trade-sim-xo" data-xoe-mech="trade">
          <XoeMechPortrait reduced={reducedMotion} firing={firing} />
          <span className="fine">XOE</span>
        </div>
        <p className="fine trade-sim-note">
          Ship = XOE {formatXoeTickPrice(price)} · vol {vol.toFixed(3)} · {XOE_SIM_SAFETY}. {XOE_SIM_LABEL}. Combat is simulated bots — pause or ease anytime.
        </p>
      </div>
      <svg
        className={`trade-sim-field${state.flash ? " is-hit" : ""}`}
        viewBox={`0 0 ${ARENA_W} ${ARENA_H}`}
        width="100%"
        height={ARENA_H}
        role="img"
        aria-label="Simulated price ship and bot attackers"
      >
        <defs>
          <linearGradient id="simSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1020" />
            <stop offset="100%" stopColor="#151228" />
          </linearGradient>
        </defs>
        <rect width={ARENA_W} height={ARENA_H} fill="url(#simSky)" rx="10" />
        {history.length > 1
          ? priceLine(history)
          : null}
        {state.shots.map((s) => (
          <line key={s.id} className={`sim-laser sim-laser-${s.from}`} x1={s.x} y1={s.y} x2={s.x + (s.from === "ship" ? 18 : -18)} y2={s.y} strokeWidth="2" />
        ))}
        {state.enemies.map((en) => (
          <g key={en.id} className="sim-bot" transform={`translate(${en.x}, ${en.y})`}>
            {state.lockId === en.id ? <circle className="sim-lock" r="14" fill="none" stroke="#78e6ff" strokeWidth="1.5" /> : null}
            <polygon points="-8,0 10,-7 10,7" fill="#f87171" />
          </g>
        ))}
        <g className={`sim-ship${state.bounce > 0.4 ? " is-bounce" : ""}${positionSide !== "flat" ? ` is-${positionSide}` : ""}${state.bounce > 0.4 && tradeImpulse ? " is-trade" : ""}`} transform={`translate(${SHIP_X}, ${state.shipY + Math.sin(state.bounce * Math.PI) * -10 + state.tradeKick * 10})`}>
          {state.flash ? <circle r="22" fill="none" stroke="#78e6ff" strokeWidth="3" opacity="0.8" data-shield="hit" /> : <circle r="18" fill="none" stroke="rgba(120,230,255,0.35)" strokeWidth="2" data-shield="idle" />}
          <ellipse cx="0" cy="10" rx="12" ry="4" fill="rgba(0,0,0,0.35)" />
          <path d="M-14 4 L18 0 L-14 -4 L-8 0 Z" fill="#f4f1ff" stroke="#a78bfa" strokeWidth="1.5" />
          <circle cx="4" cy="0" r="2.4" fill="#78e6ff" />
        </g>
        <g transform={`translate(${XOE_X}, ${XOE_Y})`} opacity="0.0">
          {/* layout slot; portrait is HTML beside the RSI box */}
        </g>
        <text x="10" y="16" fill="#c4b5fd" fontSize="10">{formatXoeTickPrice(price)}{positionSide !== "flat" ? ` · SNL ${positionSide}` : ""}</text>
        <text x="10" y={ARENA_H - 8} fill="#94a3b8" fontSize="9">Shield {Math.round(state.shield)}/{SHIELD_MAX} · sim only</text>
      </svg>
      <div className="menu-row trade-sim-controls">
        <button type="button" className="touch-btn primary" disabled={state.paused} onClick={shoot} aria-label="Fire lasers">
          Fire
        </button>
        <button type="button" className="touch-btn" disabled={state.paused} onClick={() => { dash.current = true }} aria-label="Burst dash">
          Dash
        </button>
        <button type="button" className="touch-btn" onClick={() => setState(toggleArenaPaused)} aria-pressed={state.paused}>
          {state.paused ? "Resume combat" : "Pause combat"}
        </button>
        <button type="button" className="touch-btn ghost" onClick={() => setState(toggleArenaEased)} aria-pressed={state.eased}>
          {state.eased ? "Ease off" : "Ease combat"}
        </button>
      </div>
    </div>
  )
}

function priceLine(history: readonly number[]) {
  const min = 5
  const max = 20
  const pts = history.slice(-48).map((p, i, arr) => {
    const x = (i / Math.max(1, arr.length - 1)) * (ARENA_W - 24) + 8
    const t = (Math.max(min, Math.min(max, p)) - min) / (max - min)
    const y = ARENA_H - 28 - t * (ARENA_H - 56)
    return `${x},${y}`
  })
  return <polyline points={pts.join(" ")} fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" />
}
