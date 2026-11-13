import { MOON_SCENERY } from "./overworld-scenery.ts"

/** World-space flare beam originating at Sol. Decorative only. */
export function SolarFlareFx({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const sol = MOON_SCENERY.find((m) => m.id === "sol") ?? { x: 640, y: 700 }
  return (
    <svg className={`solar-flare-sweep${reducedMotion ? " is-still" : ""}`} width="1200" height="800" viewBox="0 0 1200 800" aria-hidden="true">
      <defs>
        <linearGradient id="xoeFlareBeam" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255, 80, 20, 0)" />
          <stop offset="35%" stopColor="rgba(255, 120, 30, 0.35)" />
          <stop offset="55%" stopColor="rgba(255, 230, 160, 0.7)" />
          <stop offset="75%" stopColor="rgba(255, 90, 30, 0.28)" />
          <stop offset="100%" stopColor="rgba(255, 40, 0, 0)" />
        </linearGradient>
        <radialGradient id="xoeFlareCrown" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 240, 180, 0.9)" />
          <stop offset="45%" stopColor="rgba(255, 100, 30, 0.45)" />
          <stop offset="100%" stopColor="rgba(255, 40, 0, 0)" />
        </radialGradient>
      </defs>
      <g className="solar-flare-origin" transform={`translate(${sol.x} ${sol.y})`}>
        <circle r="90" fill="url(#xoeFlareCrown)" />
        <polygon className="solar-flare-wedge" points="0,0 980,-260 980,80" fill="url(#xoeFlareBeam)" />
      </g>
    </svg>
  )
}
