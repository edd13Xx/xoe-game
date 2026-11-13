import { useEffect, useRef } from "react"
import { FLARE_BURST_MS, drawSolarAtmosphere } from "../game/solar-atmosphere.ts"
import { useDocumentHidden } from "./runtime.ts"

/**
 * 2D canvas atmosphere. Always paints slow plasma wisps; when redDay rises
 * it plays a short SDO-style limb explosion, then returns to the ambient bed.
 * Reduced motion: one static glow, no drifting or erupting motion.
 */
export function PlasmaCanvas({
  redDay = false,
  reducedMotion = false,
  mode = "backdrop",
}: {
  redDay?: boolean
  reducedMotion?: boolean
  mode?: "backdrop" | "sol"
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const prevRed = useRef(false)
  const burstStart = useRef<number | null>(null)
  const hidden = useDocumentHidden()

  useEffect(() => {
    if (redDay && !prevRed.current) burstStart.current = performance.now()
    if (!redDay) burstStart.current = null
    prevRed.current = redDay
  }, [redDay])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let raf = 0
    let lastDraw = 0
    let running = true
    const parent = canvas.parentElement

    const resize = () => {
      const cssW = Math.max(1, parent?.clientWidth || canvas.clientWidth || 1)
      const cssH = Math.max(1, parent?.clientHeight || canvas.clientHeight || 1)
      const long = Math.max(cssW, cssH)
      const maxLong = mode === "sol" ? 320 : cssW >= 900 ? 512 : 640
      const fit = long > maxLong ? maxLong / long : 1
      const cap = reducedMotion || mode === "sol" ? 1 : Math.min(window.devicePixelRatio || 1, cssW >= 900 ? 1 : 1.25)
      const pw = Math.max(1, Math.round(cssW * fit * cap))
      const ph = Math.max(1, Math.round(cssH * fit * cap))
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
      }
      return { w: pw, h: ph }
    }

    const frame = (now: number) => {
      if (!running) return
      const bursting = burstStart.current != null && now - burstStart.current < FLARE_BURST_MS
      canvas.setAttribute("data-flare-burst", bursting ? "1" : "0")
      canvas.setAttribute("data-plasma", "1")
      const wide = (parent?.clientWidth || canvas.clientWidth || 0) >= 900
      const minGap = hidden ? 800 : reducedMotion ? 1000 : bursting ? 16 : wide ? 100 : 80
      if (now - lastDraw >= minGap) {
        lastDraw = now
        const { w, h } = resize()
        drawSolarAtmosphere(ctx, {
          width: w,
          height: h,
          nowMs: now,
          burstStartMs: burstStart.current,
          redDay,
          reducedMotion,
          mode,
        })
      }
      if (!hidden) raf = requestAnimationFrame(frame)
    }

    resize()
    raf = requestAnimationFrame(frame)
    const onResize = () => {
      lastDraw = 0
    }
    window.addEventListener("resize", onResize)
    window.visualViewport?.addEventListener("resize", onResize)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      window.visualViewport?.removeEventListener("resize", onResize)
    }
  }, [redDay, reducedMotion, hidden, mode])

  return <canvas ref={ref} className={`plasma-canvas is-${mode}`} aria-hidden="true" data-plasma="1" data-flare-burst="0" />
}
