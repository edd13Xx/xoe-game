import { useEffect, useRef } from "react"
import { drawXoShield, tookFightHit } from "../game/shield-visual.ts"
import { conditionFlowSec, xoCondition } from "../game/fight-visuals.ts"

/** Original sleek energy craft for combat (not a mech body). Shield still reacts to real hits. */
export function FightXo({ hp, maxHp = 100, shield, reduced }: { hp: number; maxHp?: number; shield: number; reduced: boolean }) {
  const cond = xoCondition(hp, maxHp)
  const condRef = useRef(cond)
  condRef.current = cond
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previous = useRef<{ hp: number; shield: number } | null>(null)
  const impact = useRef(-Infinity)
  const paint = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (tookFightHit(previous.current, { hp, shield })) impact.current = performance.now()
    previous.current = { hp, shield }
    paint.current?.()
  }, [hp, shield, maxHp])
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return
    let alive = true
    let raf = 0
    /** Glowing grooves along the hull: colour shows condition, dashes flow nose-to-tail (still with reduced motion). */
    const drawEnergyLines = () => {
      const c = condRef.current
      const flow = conditionFlowSec(c.tone, reduced)
      const offset = flow ? -((performance.now() / 1000 / flow) % 1) * 12 : 0
      ctx.save()
      ctx.strokeStyle = c.color
      ctx.shadowColor = c.color
      ctx.shadowBlur = 4
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 7])
      ctx.lineDashOffset = offset
      ctx.beginPath(); ctx.moveTo(22, 0.5); ctx.lineTo(-17, 5.5); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(22, -0.5); ctx.lineTo(-17, -5.5); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
    const drawCraft = () => {
      ctx.save()
      ctx.translate(48, 52)
      ctx.fillStyle = "rgba(0,0,0,0.28)"
      ctx.beginPath(); ctx.ellipse(0, 18, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = "#f4f1ff"
      ctx.strokeStyle = "#a78bfa"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-22, 8)
      ctx.lineTo(26, 0)
      ctx.lineTo(-22, -8)
      ctx.lineTo(-12, 0)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      drawEnergyLines()
      ctx.fillStyle = condRef.current.color
      ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = "#c4b5fd"
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }
    const draw = () => {
      if (!alive) return
      cancelAnimationFrame(raf)
      const elapsed = performance.now() - impact.current
      const progress = Math.min(1, elapsed / 700)
      const visible = elapsed >= 0 && elapsed < (reduced ? 350 : 700)
      ctx.clearRect(0, 0, 96, 96)
      ctx.imageSmoothingEnabled = false
      drawCraft()
      if (visible) drawXoShield(ctx, 48, 48, 31 + (reduced ? 0 : 8 * progress), reduced ? 0.35 : 0.7 * (1 - progress) ** 1.4)
      canvas.dataset.shield = visible ? "hit" : "idle"
      canvas.dataset.condition = condRef.current.tone
      const flowing = conditionFlowSec(condRef.current.tone, reduced) > 0
      if ((visible || flowing) && !document.hidden) raf = requestAnimationFrame(draw)
    }
    paint.current = draw
    draw()
    return () => { alive = false; cancelAnimationFrame(raf); paint.current = null }
  }, [reduced])
  return <canvas ref={canvasRef} width={96} height={96} className="fight-xo-sprite" aria-label={`XO energy craft with reactive force-field shield, condition ${cond.label}`} data-condition={cond.tone} role="img" />
}
