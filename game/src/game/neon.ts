/**
 * v13 smooth vector neon style (Eddie, Nov 9, 2026): glowing lines + gradients on the
 * dark/purple look (#0b0d12 / #7c5cff / #a78bfa). No logos.
 * Phone-fast: glow = one wide low-alpha stroke + one thin bright stroke (no shadowBlur).
 */
import type { MinimapDot, MinimapDotKind } from "./minimap.ts"

export const NEON = {
  bg: "#0b0d12",
  deep: "#151822",
  purple: "#7c5cff",
  lilac: "#a78bfa",
  cyan: "#78e6ff",
  gold: "#e4b15c",
  green: "#4ade80",
  red: "#f87171",
  white: "#f4f1ff",
} as const

type Ctx = CanvasRenderingContext2D

/** Draw the current path as a neon line (halo + core). */
export function glow(ctx: Ctx, color: string, width = 1.5, halo = 4): void {
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.22
  ctx.lineWidth = width + halo
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = width
  ctx.stroke()
  ctx.restore()
}

export function glowCircle(ctx: Ctx, x: number, y: number, r: number, color: string, width = 1.5, fill?: string): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  glow(ctx, color, width)
}

/** Soft radial light (used behind sprites so pixel characters sit in the neon scene). */
export function aura(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 0.35): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, "rgba(11,13,18,0)")
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.restore()
}

const SKY_TOP: Record<string, string> = { night: "#0b0d12", dawn: "#2a1838", day: "#1d1f3a", dusk: "#24163a" }

/** Gradient sky, neon stars, glowing horizon and a perspective grid floor. */
export function neonBackdrop(ctx: Ctx, w: number, h: number, frame: number, sky: string, reduced: boolean): number {
  const horizon = Math.round(h * 0.62)
  const g = ctx.createLinearGradient(0, 0, 0, horizon)
  g.addColorStop(0, SKY_TOP[sky] ?? NEON.bg)
  g.addColorStop(1, "#1a1233")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, horizon)
  ctx.fillStyle = NEON.bg
  ctx.fillRect(0, horizon, w, h - horizon)
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 53) % w
    const y = (i * 29) % Math.max(20, horizon - 12)
    const tw = reduced ? 0.7 : 0.45 + 0.45 * Math.sin(frame / 20 + i)
    ctx.globalAlpha = tw
    ctx.fillStyle = i % 5 === 0 ? NEON.white : NEON.lilac
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1)
  }
  ctx.globalAlpha = 1
  // horizon glow
  const hg = ctx.createLinearGradient(0, horizon - 10, 0, horizon + 6)
  hg.addColorStop(0, "rgba(124,92,255,0)")
  hg.addColorStop(0.7, "rgba(124,92,255,0.45)")
  hg.addColorStop(1, "rgba(124,92,255,0)")
  ctx.fillStyle = hg
  ctx.fillRect(0, horizon - 10, w, 16)
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  ctx.lineTo(w, horizon)
  glow(ctx, NEON.lilac, 1, 3)
  // perspective grid
  ctx.save()
  ctx.globalAlpha = 0.55
  const vx = w / 2
  for (let i = -8; i <= 8; i += 1) {
    ctx.beginPath()
    ctx.moveTo(vx + i * 6, horizon)
    ctx.lineTo(vx + i * 48, h)
    ctx.strokeStyle = NEON.purple
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  const scroll = reduced ? 0 : (frame % 30) / 30
  for (let j = 0; j < 7; j += 1) {
    const t = (j + scroll) / 7
    const y = horizon + (h - horizon) * t * t
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.strokeStyle = NEON.purple
    ctx.lineWidth = 0.6 + t
    ctx.stroke()
  }
  ctx.restore()
  return horizon
}

export function neonMoons(ctx: Ctx): void {
  glowCircle(ctx, 54, 28, 7, NEON.gold, 1.2, "rgba(228,177,92,0.25)")
  glowCircle(ctx, 250, 24, 11, NEON.cyan, 1.2, "rgba(120,230,255,0.12)")
}

/** Vector scam drone: diamond hull + red eye + rotor line. */
export function neonDrone(ctx: Ctx, x: number, y: number, frame: number, threat = false): void {
  const spin = Math.sin(frame / 6) * 4
  ctx.beginPath()
  ctx.moveTo(x, y - 6)
  ctx.lineTo(x + 9, y)
  ctx.lineTo(x, y + 6)
  ctx.lineTo(x - 9, y)
  ctx.closePath()
  ctx.fillStyle = "rgba(21,24,34,0.9)"
  ctx.fill()
  glow(ctx, threat ? NEON.red : NEON.lilac, 1.2, 3)
  ctx.beginPath()
  ctx.moveTo(x - 6 - spin, y - 9)
  ctx.lineTo(x + 6 + spin, y - 9)
  glow(ctx, NEON.cyan, 0.8, 2)
  ctx.fillStyle = NEON.red
  ctx.fillRect(x - 1, y - 1, 3, 3)
}

/** Neon platform where the story stands. */
export function neonDeck(ctx: Ctx, w: number, h: number): void {
  const y = h - 50
  ctx.beginPath()
  ctx.moveTo(24, y)
  ctx.lineTo(w - 24, y)
  ctx.lineTo(w - 40, y + 20)
  ctx.lineTo(40, y + 20)
  ctx.closePath()
  ctx.fillStyle = "rgba(124,92,255,0.10)"
  ctx.fill()
  glow(ctx, NEON.lilac, 1, 3)
}

/** Edge vignette (purple-tinted) instead of the old grey fog. */
export function neonVignette(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.62)
  g.addColorStop(0, "rgba(11,13,18,0)")
  g.addColorStop(1, "rgba(11,13,18,0.85)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export const MINIMAP_COLORS: Record<MinimapDotKind, string> = {
  player: NEON.cyan,
  colony: NEON.lilac,
  "colony-done": NEON.purple,
  "colony-next": NEON.white,
  "colony-locked": "#5b5675",
  hub: NEON.gold,
  enemy: NEON.red,
  pickup: NEON.green,
}

/** HUD mini map in neon (dots come from projectMinimap). */
export function drawNeonMinimap(
  ctx: Ctx,
  dots: readonly MinimapDot[],
  view: { x: number; y: number; w: number; h: number } | null,
  frame: number,
  w = ctx.canvas.width,
  h = ctx.canvas.height,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "rgba(26,18,51,0.92)")
  g.addColorStop(1, "rgba(11,13,18,0.92)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.beginPath()
  ctx.rect(1, 1, w - 2, h - 2)
  glow(ctx, NEON.purple, 1, 3)
  // route line through colonies in order
  const route = dots.filter((d) => d.kind.startsWith("colony"))
  if (route.length > 1) {
    ctx.beginPath()
    route.forEach((d, i) => (i ? ctx.lineTo(d.x, d.y) : ctx.moveTo(d.x, d.y)))
    ctx.save()
    ctx.globalAlpha = 0.5
    glow(ctx, NEON.purple, 0.8, 2)
    ctx.restore()
  }
  if (view) {
    ctx.beginPath()
    ctx.rect(view.x, view.y, view.w, view.h)
    ctx.save()
    ctx.globalAlpha = 0.6
    glow(ctx, NEON.cyan, 0.7, 1.5)
    ctx.restore()
  }
  for (const d of dots) {
    const c = MINIMAP_COLORS[d.kind]
    if (d.kind === "enemy") {
      ctx.beginPath()
      ctx.moveTo(d.x, d.y - d.r - 1)
      ctx.lineTo(d.x + d.r + 1, d.y + d.r)
      ctx.lineTo(d.x - d.r - 1, d.y + d.r)
      ctx.closePath()
      ctx.fillStyle = c
      ctx.fill()
      glow(ctx, c, 0.8, 2)
    } else if (d.kind === "player") {
      aura(ctx, d.x, d.y, d.r * 3, c, 0.5)
      glowCircle(ctx, d.x, d.y, d.r, NEON.white, 1.2, c)
    } else {
      const filled = d.kind === "colony-done" || d.kind === "pickup" || d.kind === "hub"
      glowCircle(ctx, d.x, d.y, d.r, c, 1, filled ? c : "rgba(11,13,18,0.9)")
      if (d.kind === "colony-next") {
        const pulse = 2 + Math.abs(Math.sin(frame / 15)) * 3
        glowCircle(ctx, d.x, d.y, d.r + pulse, NEON.lilac, 0.6)
      }
    }
  }
}
