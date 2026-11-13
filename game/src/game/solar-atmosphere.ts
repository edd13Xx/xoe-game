/**
 * Screen-space solar atmosphere: always-on drifting plasma, plus a short
 * SDO/AIA-like flare burst on the limb of Sol when a red day starts.
 * Pure canvas drawing — no HUD, no economy, no network.
 */

export const FLARE_BURST_MS = 3200
/** Peak of the white-hot core, as a fraction of the burst. */
export const FLARE_FLASH_PEAK = 0.14
export const FLARE_CME_START = 0.18
export const FLARE_CME_PEAK = 0.62

export interface ExplosionClock {
  /** 0–1 through the burst; 1 once finished. */
  t: number
  done: boolean
  /** 0–1 white-core intensity. */
  flash: number
  /** 0–1 expanding CME envelope. */
  cme: number
  /** 0–1 magnetic-loop intensity. */
  loops: number
  /** Residual orange-red afterglow. */
  glow: number
}

export function explosionClock(elapsedMs: number, durationMs = FLARE_BURST_MS): ExplosionClock {
  if (elapsedMs < 0) return { t: 0, done: false, flash: 0, cme: 0, loops: 0, glow: 0 }
  const t = Math.min(1, elapsedMs / durationMs)
  const done = elapsedMs >= durationMs
  const flash = pulse(t, 0.06, FLARE_FLASH_PEAK, 0.34)
  const loops = pulse(t, 0.1, 0.32, 0.92)
  const cme = t < FLARE_CME_START ? 0 : Math.min(1, (t - FLARE_CME_START) / (FLARE_CME_PEAK - FLARE_CME_START))
  const glow = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8)
  return { t, done, flash, cme, loops, glow }
}

/** Raised-cosine pulse that peaks at `peak` and dies by `end`. */
export function pulse(t: number, start: number, peak: number, end: number): number {
  if (t <= start || t >= end) return 0
  if (t <= peak) return 0.5 - 0.5 * Math.cos(((t - start) / Math.max(1e-6, peak - start)) * Math.PI)
  return 0.5 + 0.5 * Math.cos(((t - peak) / Math.max(1e-6, end - peak)) * Math.PI)
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface AtmosphereDrawOpts {
  width: number
  height: number
  nowMs: number
  /** performance.now() when the burst began, or null. */
  burstStartMs: number | null
  redDay: boolean
  reducedMotion: boolean
  /** Backdrop places Sol on the lower sky; sol is a close crop around the disk. */
  mode: "backdrop" | "sol"
}

function solPlacement(opts: AtmosphereDrawOpts): { x: number; y: number; r: number; angle: number } {
  const { width: w, height: h, mode } = opts
  if (mode === "sol") {
    return { x: w * 0.3, y: h * 0.62, r: Math.min(w, h) * 0.22, angle: -0.55 }
  }
  // Upper-right sky of the map shell, above the world islands so the limb is visible.
  return { x: w * 0.58, y: h * 0.2, r: Math.min(w, h) * 0.18, angle: 2.7 }
}

export function drawSolarAtmosphere(ctx: CanvasRenderingContext2D, opts: AtmosphereDrawOpts): ExplosionClock | null {
  const { width: w, height: h, nowMs, burstStartMs, redDay, reducedMotion, mode } = opts
  ctx.clearRect(0, 0, w, h)
  const sol = solPlacement(opts)
  const elapsed = burstStartMs == null ? -1 : nowMs - burstStartMs
  const clock = elapsed >= 0 ? explosionClock(elapsed) : null
  const bursting = clock != null && !clock.done
  const intensity = redDay ? 1 : 0.42

  if (!reducedMotion) {
    drawAmbientPlasma(ctx, w, h, nowMs, intensity, mode)
  } else {
    drawAmbientPlasma(ctx, w, h, 0, intensity * 0.85, mode)
  }

  if (mode === "backdrop") {
    const a = bursting ? 0.95 : redDay ? 0.7 : 0.4
    drawSolDisk(ctx, sol, a, bursting || redDay)
  } else if (mode === "sol") {
    drawSolDisk(ctx, sol, redDay || bursting ? 0.95 : 0.65, true)
  }

  if (clock && (bursting || clock.glow > 0.02)) {
    if (reducedMotion) {
      drawStaticBurst(ctx, sol, Math.max(clock.flash, clock.glow * 0.7))
    } else {
      drawExplosion(ctx, sol, clock, nowMs)
    }
  }

  return clock
}

function drawSolDisk(
  ctx: CanvasRenderingContext2D,
  sol: { x: number; y: number; r: number },
  alpha: number,
  detailed: boolean,
): void {
  const { x, y, r } = sol
  const limb = ctx.createRadialGradient(x - r * 0.25, y - r * 0.28, r * 0.08, x, y, r)
  limb.addColorStop(0, `rgba(255, 250, 220, ${0.95 * alpha})`)
  limb.addColorStop(0.22, `rgba(255, 200, 80, ${0.9 * alpha})`)
  limb.addColorStop(0.55, `rgba(255, 110, 20, ${0.85 * alpha})`)
  limb.addColorStop(0.82, `rgba(180, 30, 8, ${0.75 * alpha})`)
  limb.addColorStop(1, `rgba(40, 0, 0, 0)`)
  ctx.fillStyle = limb
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()

  if (detailed) {
    const rand = mulberry32(9041)
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r * 0.92, 0, Math.PI * 2)
    ctx.clip()
    ctx.globalAlpha = 0.22 * alpha
    for (let i = 0; i < 28; i++) {
      const px = x + (rand() - 0.5) * r * 1.6
      const py = y + (rand() - 0.5) * r * 1.6
      const pr = r * (0.04 + rand() * 0.1)
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr)
      g.addColorStop(0, rand() > 0.55 ? "rgba(255, 240, 180, 1)" : "rgba(120, 20, 0, 1)")
      g.addColorStop(1, "rgba(255, 120, 0, 0)")
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawAmbientPlasma(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nowMs: number,
  intensity: number,
  mode: "backdrop" | "sol",
): void {
  const t = nowMs / 1000
  const n = mode === "backdrop" ? 10 : 6
  ctx.save()
  ctx.globalCompositeOperation = "lighter"
  for (let i = 0; i < n; i++) {
    const seed = i * 17.13
    const drift = t * (0.035 + (i % 3) * 0.012) + seed
    const y0 = h * (0.08 + ((i * 0.11) % 0.7))
    const amp = h * (0.04 + (i % 4) * 0.015) * (mode === "backdrop" ? 1 : 0.55)
    const alpha = (0.08 + (i % 3) * 0.028) * intensity
    const col =
      i % 3 === 0
        ? `rgba(255, 90, 40, ${alpha})`
        : i % 3 === 1
          ? `rgba(80, 220, 255, ${alpha})`
          : `rgba(255, 70, 160, ${alpha})`
    ctx.strokeStyle = col
    ctx.lineWidth = (mode === "backdrop" ? 1.6 : 1.2) + (i % 3)
    ctx.beginPath()
    const steps = 18
    for (let s = 0; s <= steps; s++) {
      const u = s / steps
      const x = w * (u * 1.15 - 0.08) + Math.sin(drift + i) * w * 0.03
      const y = y0 + Math.sin(u * 4.2 + drift) * amp + Math.sin(u * 9 + seed) * amp * 0.35
      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // Soft aurora sheets along the top and the Sol-side edge, kept away from the map centre.
  if (mode === "backdrop") {
    const sheet = ctx.createLinearGradient(0, 0, 0, h * 0.4)
    sheet.addColorStop(0, `rgba(255, 80, 50, ${0.16 * intensity})`)
    sheet.addColorStop(0.45, `rgba(80, 160, 255, ${0.11 * intensity})`)
    sheet.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = sheet
    ctx.beginPath()
    ctx.moveTo(0, 0)
    const topSteps = 12
    for (let s = 0; s <= topSteps; s++) {
      const u = s / topSteps
      ctx.lineTo(w * u, h * 0.12 + Math.sin(t * 0.15 + u * 5) * h * 0.05)
    }
    ctx.lineTo(w, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawStaticBurst(
  ctx: CanvasRenderingContext2D,
  sol: { x: number; y: number; r: number; angle: number },
  amount: number,
): void {
  const { x, y, r, angle } = sol
  const lx = x + Math.cos(angle) * r * 0.92
  const ly = y + Math.sin(angle) * r * 0.92
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 2.4)
  g.addColorStop(0, `rgba(255, 255, 245, ${0.95 * amount})`)
  g.addColorStop(0.18, `rgba(255, 220, 140, ${0.7 * amount})`)
  g.addColorStop(0.45, `rgba(255, 90, 20, ${0.4 * amount})`)
  g.addColorStop(1, "rgba(80, 0, 0, 0)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(lx, ly, r * 2.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  sol: { x: number; y: number; r: number; angle: number },
  clock: ExplosionClock,
  nowMs: number,
): void {
  const { x, y, r, angle } = sol
  const lx = x + Math.cos(angle) * r * 0.92
  const ly = y + Math.sin(angle) * r * 0.92
  ctx.save()
  ctx.globalCompositeOperation = "lighter"

  if (clock.glow > 0) {
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * (2.2 + clock.glow))
    g.addColorStop(0, `rgba(255, 120, 30, ${0.28 * clock.glow})`)
    g.addColorStop(0.5, `rgba(200, 30, 0, ${0.16 * clock.glow})`)
    g.addColorStop(1, "rgba(40, 0, 0, 0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(lx, ly, r * (2.2 + clock.glow), 0, Math.PI * 2)
    ctx.fill()
  }

  if (clock.loops > 0) {
    const n = 7
    for (let i = 0; i < n; i++) {
      const a0 = angle - 0.55 + (i / (n - 1)) * 1.15
      const reach = r * (0.9 + clock.loops * (1.4 + i * 0.18))
      const wobble = Math.sin(nowMs / 180 + i) * r * 0.08
      const x1 = lx + Math.cos(a0) * reach
      const y1 = ly + Math.sin(a0) * reach
      const cx = lx + Math.cos(a0 - 0.4) * reach * 0.55 + wobble
      const cy = ly + Math.sin(a0 - 0.4) * reach * 0.55
      const backX = x + Math.cos(angle + 0.35 + i * 0.08) * r * 0.85
      const backY = y + Math.sin(angle + 0.35 + i * 0.08) * r * 0.85
      ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 230, 180, ${0.55 * clock.loops})` : `rgba(255, 80, 40, ${0.45 * clock.loops})`
      ctx.lineWidth = 1.4 + (i % 3)
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.quadraticCurveTo(cx, cy, x1, y1)
      ctx.quadraticCurveTo(cx + (backX - lx) * 0.2, cy + r * 0.15, backX, backY)
      ctx.stroke()
    }
  }

  if (clock.cme > 0) {
    const reach = r * (1.2 + clock.cme * 4.6)
    const nx = Math.cos(angle)
    const ny = Math.sin(angle)
    const px = -ny
    const py = nx
    const ex = lx + nx * reach
    const ey = ly + ny * reach
    const hw = r * (0.6 + clock.cme * 1.8)
    const plume = ctx.createRadialGradient(lx, ly, r * 0.2, ex, ey, reach)
    plume.addColorStop(0, `rgba(255, 250, 230, ${0.55 * Math.min(1, clock.cme * 1.4)})`)
    plume.addColorStop(0.25, `rgba(255, 160, 60, ${0.35 * clock.cme})`)
    plume.addColorStop(0.6, `rgba(255, 50, 10, ${0.18 * clock.cme})`)
    plume.addColorStop(1, "rgba(80, 0, 0, 0)")
    ctx.fillStyle = plume
    ctx.beginPath()
    ctx.moveTo(lx + px * r * 0.25, ly + py * r * 0.25)
    ctx.quadraticCurveTo(lx + nx * reach * 0.45 + px * hw, ly + ny * reach * 0.45 + py * hw, ex + px * hw * 0.4, ey + py * hw * 0.4)
    ctx.quadraticCurveTo(ex + nx * r * 0.4, ey + ny * r * 0.4, ex - px * hw * 0.4, ey - py * hw * 0.4)
    ctx.quadraticCurveTo(lx + nx * reach * 0.45 - px * hw, ly + ny * reach * 0.45 - py * hw, lx - px * r * 0.25, ly - py * r * 0.25)
    ctx.closePath()
    ctx.fill()
    // Leading edge of the CME bubble
    ctx.strokeStyle = `rgba(255, 220, 180, ${0.35 * clock.cme})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(ex, ey, hw * 0.55, hw * 0.32, angle, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (clock.flash > 0) {
    const core = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * (0.7 + clock.flash * 1.6))
    core.addColorStop(0, `rgba(255, 255, 255, ${0.98 * clock.flash})`)
    core.addColorStop(0.18, `rgba(255, 250, 210, ${0.9 * clock.flash})`)
    core.addColorStop(0.42, `rgba(255, 170, 50, ${0.55 * clock.flash})`)
    core.addColorStop(1, "rgba(255, 40, 0, 0)")
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(lx, ly, r * (0.7 + clock.flash * 1.6), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}
