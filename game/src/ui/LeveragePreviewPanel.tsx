import { useState } from "react"
import { FEES_LEVERAGE_LABEL, SIM_EXAMPLE, leveragePreview, leveragePreviewLine } from "../game/fees-leverage.ts"

const LEVERAGES = [1, 2, 5] as const
const MOVES = [-20, -2, 2] as const

/**
 * v18 optional sim leverage preview inside the Fees and leverage lesson.
 * Pure math on sim numbers. It cannot place, open, or close any trade.
 */
export function LeveragePreviewPanel() {
  const [leverage, setLeverage] = useState<number>(SIM_EXAMPLE.leverage)
  const [movePct, setMovePct] = useState<number>(SIM_EXAMPLE.movePct)
  const [cushion, setCushion] = useState(false)
  const input = {
    margin: SIM_EXAMPLE.margin,
    leverage,
    movePct,
    cushion: cushion ? SIM_EXAMPLE.cushion : 0,
  }
  const p = leveragePreview(input)
  return (
    <details className="panel leverage-preview" data-leverage-preview="1">
      <summary>Sim leverage preview (optional)</summary>
      <p className="fine">
        {FEES_LEVERAGE_LABEL}. You put up ${SIM_EXAMPLE.margin} sim. Fee {SIM_EXAMPLE.feePct}% to open and to close. No
        trade is placed.
      </p>
      <div className="menu-row" role="group" aria-label="Sim leverage">
        {LEVERAGES.map((l) => (
          <button key={l} type="button" className="touch-btn" aria-pressed={leverage === l} onClick={() => setLeverage(l)}>
            {l}X
          </button>
        ))}
      </div>
      <div className="menu-row" role="group" aria-label="Sim price move">
        {MOVES.map((m) => (
          <button key={m} type="button" className="touch-btn" aria-pressed={movePct === m} onClick={() => setMovePct(m)}>
            {m > 0 ? `+${m}` : m}%
          </button>
        ))}
      </div>
      <div className="menu-row">
        <button type="button" className="touch-btn" aria-pressed={cushion} onClick={() => setCushion((c) => !c)}>
          {cushion ? `Cushion $${SIM_EXAMPLE.cushion} on` : "Add a cushion"}
        </button>
      </div>
      <p className="preview-line" role="status" data-preview-line="1">
        {leveragePreviewLine(p, input)}
      </p>
      <p className="fine">Break-even ≈ {p.breakEvenPct.toFixed(2)}% at any size. Sim and testnet only.</p>
    </details>
  )
}
