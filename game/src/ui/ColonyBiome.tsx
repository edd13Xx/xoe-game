import { biomeFor, biomeParticles, type ColonyBiome } from "../game/colony-env.ts"

/** Visual-only backdrop for a colony's flight field: sky, sky body, terrain motif, hard-light floor and ambient particles. */
const W = 320
const H = 248
const HORIZON = 150

function terrain(b: ColonyBiome) {
  const [far, near] = b.ground
  const a = b.accent
  switch (b.terrain) {
    case "spore-hills":
      return (
        <>
          <path d={`M0 ${HORIZON} C40 128 80 132 120 146 C170 120 220 126 260 142 C290 134 310 136 320 140 V${H} H0Z`} fill={far} />
          <path d={`M0 176 C60 158 110 164 160 172 C210 156 270 160 320 170 V${H} H0Z`} fill={near} opacity="0.9" />
          {[[44, 160, "#9b7dff"], [92, 168, "#c4b5fd"], [228, 162, "#7c5cff"], [278, 166, "#9b7dff"]].map(([x, y, c], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect x="-1.5" y="-10" width="3" height="10" fill="#c4b5fd" opacity="0.7" />
              <ellipse cx="0" cy="-12" rx="9" ry="5" fill={c as string} opacity="0.85" />
            </g>
          ))}
        </>
      )
    case "crystal-spires":
      return (
        <>
          <path d={`M0 ${HORIZON} L30 120 L50 146 L84 96 L110 148 L150 110 L176 150 L214 88 L240 148 L276 118 L300 150 L320 132 V${H} H0Z`} fill={far} />
          {[[60, 80], [150, 66], [250, 76]].map(([x, t], i) => (
            <path key={i} d={`M${x - 8} 176 L${x} ${t + 70} L${x + 8} 176Z`} fill={a} opacity="0.35" />
          ))}
          <path d={`M0 180 L320 172 V${H} H0Z`} fill={near} />
        </>
      )
    case "block-terraces":
      return (
        <>
          <path d={`M0 ${HORIZON} H40 V136 H80 V122 H120 V108 H160 V122 H200 V136 H240 V128 H280 V142 H320 V${H} H0Z`} fill={far} />
          <path d={`M0 178 H70 V168 H140 V178 H200 V164 H260 V174 H320 V${H} H0Z`} fill={near} opacity="0.9" />
          <path d="M120 108 H160" stroke={a} strokeWidth="2" opacity="0.6" />
        </>
      )
    case "toll-arches":
      return (
        <>
          <path d={`M0 ${HORIZON} C80 140 240 140 320 ${HORIZON} V${H} H0Z`} fill={far} />
          {[60, 160, 260].map((x) => (
            <path key={x} d={`M${x - 22} 170 V146 A22 22 0 0 1 ${x + 22} 146 V170`} fill="none" stroke={a} strokeWidth="3" opacity="0.5" />
          ))}
          <path d={`M0 172 H320 V${H} H0Z`} fill={near} opacity="0.85" />
        </>
      )
    case "dew-shoals":
      return (
        <>
          <path d={`M0 ${HORIZON} H320 V${H} H0Z`} fill={far} opacity="0.85" />
          {[[50, 164, 34], [150, 172, 44], [260, 162, 30]].map(([x, y, rx], i) => (
            <ellipse key={i} cx={x} cy={y} rx={rx} ry={rx / 3.2} fill={near} />
          ))}
          <path d={`M0 ${HORIZON + 4} H320`} stroke={a} strokeWidth="1" opacity="0.5" />
        </>
      )
    case "cracked-atoll":
      return (
        <>
          <path d={`M0 ${HORIZON} L40 136 L70 148 L110 128 L150 146 L196 120 L232 144 L280 130 L320 146 V${H} H0Z`} fill={far} />
          <path d="M40 176 L90 160 L120 182 L180 158 L230 180 L290 162" fill="none" stroke={a} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />
          <path d={`M0 184 L320 178 V${H} H0Z`} fill={near} />
        </>
      )
    case "twin-isles":
      return (
        <>
          <path d={`M0 ${HORIZON + 6} H320 V${H} H0Z`} fill="#16223a" opacity="0.7" />
          <path d="M20 170 C40 140 110 138 130 170Z" fill={near} opacity="0.55" />
          <path d="M190 170 C210 138 280 140 300 170Z" fill={near} opacity="0.55" />
          <path d="M118 154 C140 128 180 128 202 154" fill="none" stroke={a} strokeWidth="2.5" opacity="0.7" />
        </>
      )
    case "storm-waves":
      return (
        <>
          <path d="M150 20 L138 70 L150 66 L132 120" fill="none" stroke={a} strokeWidth="2" opacity="0.5" className="biome-bolt" />
          <path d={`M0 ${HORIZON} Q40 132 80 150 T160 150 T240 150 T320 150 V${H} H0Z`} fill={far} />
          <path d="M0 176 Q40 160 80 176 T160 176 T240 176 T320 176 V248 H0Z" fill={near} opacity="0.9" />
          <rect x="258" y="96" width="4" height="56" fill={a} opacity="0.55" />
        </>
      )
    case "kelp-cove":
      return (
        <>
          <path d={`M0 ${HORIZON} C60 136 120 156 180 140 C240 126 290 146 320 140 V${H} H0Z`} fill={far} />
          {[30, 90, 210, 290].map((x, i) => (
            <path key={x} d={`M${x} 200 C${x - 10} 176 ${x + 10} 160 ${x - 4} ${130 + i * 6}`} fill="none" stroke={near} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
          ))}
          <circle cx="160" cy="118" r="5" fill={a} opacity="0.8" />
          <path d="M160 123 V150" stroke={a} strokeWidth="1" opacity="0.5" />
        </>
      )
    case "vault-mesa":
      return (
        <>
          <path d={`M0 ${HORIZON} L40 ${HORIZON} L60 118 L200 112 L224 ${HORIZON} L320 ${HORIZON} V${H} H0Z`} fill={far} />
          <rect x="110" y="122" width="40" height="28" rx="2" fill="#6d7480" opacity="0.6" />
          <circle cx="130" cy="136" r="4" fill="#c9a227" opacity="0.8" />
          {[20, 34, 250, 270, 292].map((x) => (
            <path key={x} d={`M${x - 7} 176 L${x} 152 L${x + 7} 176Z`} fill={near} />
          ))}
          <polygon points="268,100 272,100 320,70 320,86" fill={a} opacity="0.18" />
        </>
      )
    case "exam-grid":
      return <path d={`M0 ${HORIZON} H320 V${H} H0Z`} fill={far} opacity="0.7" />
    case "fulcrum-mesa":
      return (
        <>
          <path d={`M0 ${HORIZON} L80 132 L260 120 L320 140 V${H} H0Z`} fill={far} />
          <path d="M120 150 L160 120 L200 150Z" fill={near} />
          <rect x="70" y="112" width="180" height="5" fill={a} opacity="0.6" transform="rotate(-8 160 116)" />
        </>
      )
    default:
      return <path d={`M0 ${HORIZON} H320 V${H} H0Z`} fill={far} opacity="0.7" />
  }
}

function particle(b: ColonyBiome, p: { x: number; y: number; size: number }, i: number) {
  const c = b.particle.color
  switch (b.particle.shape) {
    case "shard":
      return <path d={`M${p.x} ${p.y - p.size * 2} L${p.x + p.size} ${p.y} L${p.x} ${p.y + p.size * 2} L${p.x - p.size} ${p.y}Z`} fill={c} key={i} />
    case "square":
      return <rect x={p.x - p.size} y={p.y - p.size} width={p.size * 2} height={p.size * 2} fill={c} key={i} />
    case "streak":
      return <path d={`M${p.x} ${p.y} l-4 12`} stroke={c} strokeWidth="1.2" key={i} />
    default:
      return <circle cx={p.x} cy={p.y} r={p.size} fill={c} key={i} />
  }
}

export function ColonyBiomeBackdrop({ colonyId, reducedMotion = false }: { colonyId: string; reducedMotion?: boolean }) {
  const b = biomeFor(colonyId)
  const gid = `biome-sky-${b.id}`
  const parts = biomeParticles(b.id)
  return (
    <div className={`colony-biome biome-${b.id}${reducedMotion ? " is-still" : ""}`} data-biome={b.id} aria-hidden="true">
      <svg className="colony-biome-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={b.sky[0]} />
            <stop offset="45%" stopColor={b.sky[1]} />
            <stop offset="62%" stopColor={b.sky[2]} />
            <stop offset="100%" stopColor={b.ground[0]} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${gid})`} />
        <g className="biome-sky-body">
          <circle cx={b.skyBody.x} cy={b.skyBody.y} r={b.skyBody.r} fill={b.skyBody.color} opacity="0.85" />
          <circle cx={b.skyBody.x - b.skyBody.r * 0.3} cy={b.skyBody.y - b.skyBody.r * 0.3} r={b.skyBody.r * 0.45} fill="#ffffff" opacity="0.25" />
          {b.skyBody.ring ? (
            <ellipse cx={b.skyBody.x} cy={b.skyBody.y} rx={b.skyBody.r * 1.9} ry={b.skyBody.r * 0.45} fill="none" stroke={b.skyBody.color} strokeWidth="1.5" opacity="0.6" transform={`rotate(-14 ${b.skyBody.x} ${b.skyBody.y})`} />
          ) : null}
        </g>
        {terrain(b)}
        <g className="biome-floor" stroke={b.accent} opacity="0.32">
          <line x1="0" y1={HORIZON} x2={W} y2={HORIZON} strokeWidth="1.2" />
          {[-240, -140, -60, 0, 60, 140, 240].map((dx) => (
            <line key={dx} x1={W / 2 + dx / 6} y1={HORIZON} x2={W / 2 + dx * 1.6} y2={H} strokeWidth="0.7" />
          ))}
          {[166, 188, 218].map((y) => (
            <line key={y} x1="0" y1={y} x2={W} y2={y} strokeWidth="0.6" />
          ))}
        </g>
        <g className={`biome-particles motion-${b.particle.motion}`}>
          {parts.map((p, i) => (
            <g key={i} className="biome-p" style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}>
              {particle(b, p, i)}
            </g>
          ))}
        </g>
      </svg>
      <span className="colony-biome-name">{b.name}</span>
    </div>
  )
}
