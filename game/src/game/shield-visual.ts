/** Visual-only shield. Never writes combat, reward or economy state. */
export function tookFightHit(previous: { hp: number; shield: number } | null, next: { hp: number; shield: number }): boolean {
  return previous !== null && (next.hp < previous.hp || next.shield < previous.shield)
}

/** Same paired cyan rings used by XO's approved near-loss force field. */
export function drawXoShield(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, opacity: number): void {
  if (opacity <= 0.02) return
  ctx.save()
  ctx.strokeStyle = "#78e6ff"
  ctx.globalAlpha = opacity
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = opacity * 0.5
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}
