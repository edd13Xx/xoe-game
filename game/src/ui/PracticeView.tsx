import { TradeResultCard } from "./TradeResultCard.tsx"
import { useContext, useEffect, useState } from "react"
import type { DialogueMode, SpeechSupport } from "../game/dialogue.ts"
import { presentDialogue } from "../game/dialogue.ts"
import { LINES } from "../game/content.ts"
import {
  TRADE_DISCLAIMER,
  TRADE_LOT_STROOPS,
  canBuy,
  canSell,
  currentPrice,
  lotCostUsd,
  paperFormulaLine,
  paperResult,
  type PaperAction,
} from "../game/practice.ts"
import { xoSpeak } from "../game/xo-speech.ts"
import {
  HEALTH_BAR_LABEL,
  LIQUIDATED_LABEL,
  XOE_UNIT,
  healthFraction,
} from "../game/xoe-lifeblood.ts"
import { formatPnlSim, formatXoe7 } from "../game/economy.ts"
import { XOE_SIM_LABEL, XOE_SIM_SAFETY } from "../game/xoe-sim-price.ts"
import type { GameState } from "../game/opening.ts"
import { DialogueMenu, GrokStatus } from "./DialogueMenu.tsx"
import { DialogueSpeaker } from "./DialogueSpeaker.tsx"
import { TickerContext, xoePriceFromSnap } from "./useTickerFeed.ts"
import { TradeSimArena } from "./TradeSimArena.tsx"
import { SnlListing } from "./SnlListing.tsx"
import type { SnlAction, SnlSide } from "../game/snl-listing.ts"
import { readFightDifficulty } from "../game/combat.ts"
import { getLocalStore } from "../game/safe-storage.ts"

export function PracticeView({
  state,
  speech,
  onMode,
  onGrok,
  onDecline,
  onResume,
  onAction,
  onRestart,
  onExit,
  onComplete,
  onTick,
  frozen = false,
  priceHistory = [],
  reducedMotion = false,
}: {
  state: GameState
  frozen?: boolean
  speech: SpeechSupport
  onMode: (mode: DialogueMode) => void
  onGrok: () => void
  onDecline: () => void
  onResume: () => void
  onAction: (action: PaperAction, price: number) => void
  onRestart: () => void
  onExit: () => void
  onComplete: () => void
  onTick?: (price: number) => void
  priceHistory?: readonly number[]
  reducedMotion?: boolean
}) {
  const paused = frozen || state.phase === "practice-pause" || state.paused
  const [snlPulse, setSnlPulse] = useState<{ seq: number; action: SnlAction | null; side: SnlSide }>({
    seq: 0,
    action: null,
    side: "flat",
  })
  const practice = state.practice
  const snap = useContext(TickerContext)
  const livePrice = xoePriceFromSnap(snap) ?? currentPrice(practice)
  const result = paperResult(practice, livePrice)
  const finished =
    practice.outcome === "paper-up" ||
    practice.outcome === "paper-down" ||
    practice.outcome === "liquidated"
  const zoe = presentDialogue(LINES.pause.text, state.dialogueMode, speech)
  const xoe = practice.xoe
  const cost = lotCostUsd(livePrice)

  useEffect(() => {
    if (practice.outcome === "liquidated") void xoSpeak("Getting totally liquidated.")
  }, [practice.outcome])

  useEffect(() => {
    if (paused || finished || !onTick) return
    onTick(livePrice)
  }, [paused, finished, livePrice, onTick])

  useEffect(() => {
    if (paused || finished) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "b" || event.key === "B") onAction("buy", livePrice)
      if (event.key === "s" || event.key === "S") onAction("sell", livePrice)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [paused, finished, onAction, livePrice])

  const pnlWord = result > 0 ? "up" : result < 0 ? "down" : "flat"

  return (
    <article className="copy-block trade-desk has-action-bar" aria-label="XOE trade">
      <h1 tabIndex={-1}>{paused ? "Practice paused" : "Trade XOE"}</h1>
      <p className="banner">{XOE_SIM_SAFETY}. {XOE_SIM_LABEL}.</p>
      <div className="xoe-health-panel" aria-label={`${HEALTH_BAR_LABEL} bar`}>
        <div className="xoe-health-meta">
          <strong>
            {HEALTH_BAR_LABEL}: {xoe.xoe} {XOE_UNIT}
          </strong>
          <span>Attempts left {xoe.lives}</span>
        </div>
        <div className="xoe-health-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xoe.xoe}>
          <div className="xoe-health-fill" style={{ width: `${healthFraction(xoe.xoe) * 100}%` }} />
        </div>
        {practice.outcome === "liquidated" ? (
          <p className="liquidated-banner" role="status">
            {LIQUIDATED_LABEL} · {XOE_SIM_SAFETY}
          </p>
        ) : null}
        {xoe.lastEffect === "gain" ? <p className="fine ok">Good move — you caught the tick.</p> : null}
        {/* v18.3 (XOE-004): no in-trade loss nudges; the result card explains after the trade closes */}
      </div>
      <p className="trade-readout" aria-live="polite">
        XOE {formatXoe7(practice.xoeStroops)} · cash {formatPnlSim(practice.cash, false)} · price {formatPnlSim(livePrice, false)}
      </p>
      <p className="trade-pnl">
        P/L {formatPnlSim(result, true)} · {pnlWord}
      </p>
      <p className="trade-formula fine">{paperFormulaLine({ ...practice, price: livePrice })}</p>
      <p className="fine">{TRADE_DISCLAIMER} Claim stays off.</p>
      {paused ? (
        <div className="panel" role="region" aria-label="Paused for Zoe">
          <p className="speaker">Zoe</p>
          {zoe.text ? <p className="bubble">{zoe.text}</p> : null}
          {zoe.status ? <p role="status">{zoe.status}</p> : null}
          <DialogueSpeaker line={zoe.speak} />
          <p>
            This is a live XOE/USD sim trade. Buy and sell stay off until you resume. Each tap is 0.1 XOE at the floating sim price.
          </p>
          <DialogueMenu mode={state.dialogueMode} onMode={onMode} onGrok={onGrok} />
          <GrokStatus open={state.grokOfferOpen} onDecline={onDecline} />
        </div>
      ) : (
        <div className="panel">
          <p>Buy XOE spends sim cash. Sell XOE sells from your balance. The price keeps ticking.<span className="kbd-hint"> B buys. S sells.</span></p>
          {finished ? (
            <p role="status">
              {practice.outcome === "liquidated"
                ? `${LIQUIDATED_LABEL}. No real money moved.`
                : `Trade complete. P/L ${formatPnlSim(result, true)}. ${XOE_SIM_SAFETY}.`}
            </p>
          ) : (
            <p role="status">Live XOE/USD sim · ${livePrice.toFixed(2)} · 0.1 XOE costs ${cost.toFixed(2)} sim</p>
          )}
        </div>
      )}
      <SnlListing
        price={livePrice}
        history={priceHistory}
        disabled={paused || finished}
        reducedMotion={reducedMotion}
        onImpulse={(action, book) => setSnlPulse((s) => ({ seq: s.seq + 1, action, side: book.side }))}
      />
      <TradeSimArena
        price={livePrice}
        history={priceHistory}
        difficulty={readFightDifficulty(getLocalStore())}
        reducedMotion={reducedMotion}
        forcePaused={paused}
        tradeImpulse={snlPulse.action}
        tradeSeq={snlPulse.seq}
        positionSide={snlPulse.side}
      />
      <TradeResultCard desk={practice} />
      {paused ? (
        <div className="action-bar" data-action-bar="practice-pause">
          <button type="button" className="touch-btn primary" onClick={onResume}>
            Resume practice
          </button>
        </div>
      ) : null}
      {!paused ? (
        /* v18: Buy/Sell + Done stay pinned at the bottom (safe-area aware) on short phone screens. */
        <div className="action-bar trade-action-bar" data-action-bar="practice">
          <p className="action-bar-pnl" aria-hidden="true">
            P/L {formatPnlSim(result, true)} · XOE {formatXoe7(practice.xoeStroops)}
          </p>
          <div className="action-bar-row">
            <button type="button" className="touch-btn primary" onClick={() => onAction("buy", livePrice)} disabled={!canBuy(practice, livePrice)}>
              Buy XOE
            </button>
            <button type="button" className="touch-btn" onClick={() => onAction("sell", livePrice)} disabled={!canSell(practice, livePrice)}>
              Sell XOE
            </button>
          </div>
          <div className="action-bar-row secondary">
            {finished ? (
              <button type="button" className="touch-btn primary" onClick={onComplete}>
                Continue story
              </button>
            ) : (
              <>
                <button type="button" className="touch-btn" onClick={onComplete}>
                  Done trading
                </button>
                <button type="button" className="touch-btn ghost" onClick={onExit}>
                  Exit practice
                </button>
              </>
            )}
            <button type="button" className="touch-btn ghost" onClick={onRestart}>
              Restart practice
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function FightTradeStrip({
  price,
  canBuyNow,
  canSellNow,
  pnlUsd,
  onBuy,
  onSell,
}: {
  price: number
  canBuyNow: boolean
  canSellNow: boolean
  pnlUsd: number
  pnlPlay: string
  onBuy: () => void
  onSell: () => void
}) {
  return (
    <div className="fight-trade" aria-label="XOE trade">
      <p className="fine">
        XOE/USD {formatPnlSim(price, false)} · P/L {formatPnlSim(pnlUsd, true)} · {XOE_SIM_SAFETY}
      </p>
      <div className="menu-row">
        <button type="button" className="touch-btn" disabled={!canBuyNow} onClick={onBuy}>
          Buy XOE
        </button>
        <button type="button" className="touch-btn" disabled={!canSellNow} onClick={onSell}>
          Sell XOE
        </button>
      </div>
    </div>
  )
}

export const TRADE_LOT = TRADE_LOT_STROOPS
