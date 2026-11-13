import {
  MOON_HORIZON as HZ,
  MOON_SCENE_H as H,
  MOON_SCENE_W as W,
  moonParticles,
  moonSceneFor,
  moonSkylinePath,
  moonStars,
  pathLights,
} from "../game/moon-scenes.ts"
import type { MoonId } from "../game/moons.ts"
import type { ReactNode } from "react"

/**
 * The art is drawn in a 320x160 box and scaled to fit the height ("meet"); wide frames (desktop, phone
 * landscape, the small choice previews) show the overflow, so the backdrop is mirrored out to both sides
 * (seams match because each copy is flipped at the box edge). Lane, gate and XO stay centered.
 */
const TILES = [
  "translate(-640 0)",
  "translate(0 0) scale(-1 1)",
  "",
  "translate(640 0) scale(-1 1)",
  "translate(640 0)",
]
function Tiled({ children }: { children: ReactNode }) {
  return (
    <>
      {TILES.map((tr, i) => (
        <g key={i} transform={tr || undefined} data-tile={i === 2 ? "center" : "side"}>
          {children}
        </g>
      ))}
    </>
  )
}

/** Visual-only Sol / Xelm environment art (original). Decorative: the caller supplies the text label. */
export function MoonScene({ moonId, powered = false, compact = false }: { moonId: MoonId; powered?: boolean; compact?: boolean }) {
  const s = moonSceneFor(moonId)
  const g = `ms-${moonId}${compact ? "-c" : ""}`
  const cold = s.terrain === "frost-spires"
  const lane = powered ? s.powered : s.accent
  return (
    <svg
      className={`moon-scene-svg${compact ? " is-compact" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
      data-moon-scene={moonId}
      data-terrain={s.terrain}
      data-phenomenon={s.phenomenon}
    >
      <defs>
        <linearGradient id={`${g}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="0.6" stopColor={s.sky[1]} />
          <stop offset="1" stopColor={s.sky[2]} />
        </linearGradient>
        <linearGradient id={`${g}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.ground[0]} />
          <stop offset="1" stopColor={s.ground[1]} />
        </linearGradient>
        <linearGradient id={`${g}-lane`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={lane} stopOpacity={powered ? 0.5 : 0.18} />
          <stop offset="1" stopColor={lane} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${g}-body`} cx="0.5" cy="0.5" r="0.5">
          {cold ? (
            <>
              <stop offset="0" stopColor="#eef8ff" />
              <stop offset="0.6" stopColor="#8fb4d4" />
              <stop offset="1" stopColor="#2a3c58" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#fff7d6" />
              <stop offset="0.45" stopColor="#ffb347" />
              <stop offset="0.8" stopColor="#ff5a1a" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ff3a0a" stopOpacity="0" />
            </>
          )}
        </radialGradient>
        <linearGradient id={`${g}-aur`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dffd6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#7dffd6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x={-3 * W} width={7 * W} height={H} fill={`url(#${g}-sky)`} />

      <Tiled>
        {moonStars(moonId).map((st, i) => (
          <circle key={`s${i}`} className="ms-star" cx={st.x} cy={st.y} r={st.r} fill={st.color} style={{ animationDelay: `${st.delay}s` }} />
        ))}
      </Tiled>

      {cold ? (
        <g className="ms-aurora" data-ms="aurora">
          <Tiled>
          <path className="ms-aur a1" d="M-10 44 C40 18 90 52 140 30 S240 14 330 36 L330 60 C240 40 190 70 140 54 S40 46 -10 66Z" fill={`url(#${g}-aur)`} />
          <path className="ms-aur a2" d="M-10 26 C60 8 110 34 170 16 S260 6 330 20 L330 38 C260 26 210 46 160 34 S50 24 -10 42Z" fill={`url(#${g}-aur)`} opacity="0.6" />
          </Tiled>
          <g transform="translate(252 30)">
            <circle r="13" fill={`url(#${g}-body)`} />
            <ellipse rx="22" ry="4" fill="none" stroke="#cfe4ff" strokeOpacity="0.55" strokeWidth="1.2" transform="rotate(-14)" />
          </g>
        </g>
      ) : (
        <g className="ms-corona" data-ms="corona">
          <circle className="ms-sun-halo" cx="92" cy={HZ - 6} r="58" fill={`url(#${g}-body)`} opacity="0.55" />
          <circle cx="92" cy={HZ - 6} r="30" fill={`url(#${g}-body)`} />
          <path className="ms-prom p1" d={`M66 ${HZ - 20} C56 ${HZ - 62} 104 ${HZ - 70} 100 ${HZ - 34}`} fill="none" stroke="#ffcf6a" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
          <path className="ms-prom p2" d={`M110 ${HZ - 26} C124 ${HZ - 58} 150 ${HZ - 44} 128 ${HZ - 16}`} fill="none" stroke="#ff8a3c" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          <rect className="ms-shimmer" x={-3 * W} y={HZ - 14} width={7 * W} height="10" fill="#ffb35a" opacity="0.14" />
        </g>
      )}

      <Tiled>
      <path d={moonSkylinePath(moonId)} fill={`url(#${g}-ground)`} />
      <path d={`M0 ${HZ + 18} C90 ${HZ + 8} 230 ${HZ + 8} ${W} ${HZ + 18} V${H} H0Z`} fill={s.ground[1]} opacity="0.92" />

      {cold ? (
        <g data-ms="spires">
          {[[34, 54], [64, 40], [262, 46], [292, 60]].map(([x, top], i) => (
            <g key={`k${i}`}>
              <path d={`M${x - 6} ${HZ + 16} L${x} ${top} L${x + 6} ${HZ + 16}Z`} fill="#16263a" stroke={s.accent} strokeOpacity="0.55" strokeWidth="0.8" />
              <circle className="ms-glint" cx={x} cy={top + 14} r="1.6" fill={s.accent} style={{ animationDelay: `${i * 0.7}s` }} />
              <rect x={x - 0.7} y={top + 16} width="1.4" height="4" fill={s.accent} opacity="0.7" />
            </g>
          ))}
          {[[54, HZ + 34, 18], [262, HZ + 30, 14], [120, HZ + 50, 10], [214, HZ + 48, 12]].map(([x, y, rx], i) => (
            <g key={`c${i}`}>
              <ellipse cx={x} cy={y} rx={rx} ry={rx / 3.6} fill="#070d16" opacity="0.85" />
              <ellipse cx={x} cy={y - 1} rx={rx} ry={rx / 3.6} fill="none" stroke="#9fb8d0" strokeOpacity="0.35" strokeWidth="0.8" />
            </g>
          ))}
        </g>
      ) : (
        <g data-ms="ridges">
          <path className="ms-crack" d={`M18 ${HZ + 30} L46 ${HZ + 24} L60 ${HZ + 36} L92 ${HZ + 28} L110 ${HZ + 44}`} fill="none" stroke={s.accent} strokeWidth="1.6" strokeLinejoin="round" />
          <path className="ms-crack c2" d={`M212 ${HZ + 42} L236 ${HZ + 30} L258 ${HZ + 38} L284 ${HZ + 26} L314 ${HZ + 34}`} fill="none" stroke="#ffcf6a" strokeWidth="1.4" strokeLinejoin="round" />
          <path className="ms-crack c3" d={`M40 ${H - 8} L70 ${HZ + 50} L96 ${H - 4}`} fill="none" stroke="#ff5a1a" strokeWidth="1.2" />
          <path d={`M0 ${HZ + 4} Q60 ${HZ - 4} 120 ${HZ + 4}`} fill="none" stroke="#ffcf6a" strokeOpacity="0.5" strokeWidth="1" />
        </g>
      )}

      </Tiled>

      <path d={`M${W / 2 - 74} ${H} L${W / 2 - 8} ${HZ + 4} L${W / 2 + 8} ${HZ + 4} L${W / 2 + 74} ${H}Z`} fill={`url(#${g}-lane)`} data-ms="lane" />
      <path d={`M${W / 2 - 74} ${H} L${W / 2 - 8} ${HZ + 4} M${W / 2 + 74} ${H} L${W / 2 + 8} ${HZ + 4}`} stroke={lane} strokeOpacity={powered ? 0.9 : 0.35} strokeWidth="1" />

      <g data-ms="gate" className={powered ? "ms-gate is-open" : "ms-gate"}>
        <path d={`M${W / 2 - 12} ${HZ + 4} V${HZ - 10} A12 12 0 0 1 ${W / 2 + 12} ${HZ - 10} V${HZ + 4}`} fill={powered ? lane : "none"} fillOpacity={powered ? 0.35 : 0} stroke={powered ? lane : "#a78bfa"} strokeWidth="2" />
      </g>

      {pathLights().map((p, i) => (
        <circle
          key={`l${i}`}
          className={powered ? "ms-light is-on" : "ms-light"}
          data-ms="light"
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={powered ? s.powered : "#3a3550"}
          style={{ animationDelay: `${p.delay}s` }}
        />
      ))}

      {compact ? null : (
        <g data-ms="xo" transform={`translate(${W / 2} ${H - 14})`}>
          <ellipse className="ms-thrust" cx="0" cy="9" rx="4" ry="7" fill={lane} opacity="0.7" />
          <path d="M0 -10 L10 6 L3 3 L0 8 L-3 3 L-10 6Z" fill="#e8e4ff" stroke="#7c5cff" strokeWidth="1" />
          <path d="M0 -6 L2.5 1 L-2.5 1Z" fill="#7c5cff" />
        </g>
      )}

      <Tiled>
      <g className={`ms-particles motion-${s.particle.motion}`} data-ms="particles">
        {moonParticles(moonId, compact ? 8 : 16).map((p, i) =>
          s.particle.shape === "flake" ? (
            <path
              key={`p${i}`}
              className="ms-p"
              d={`M${p.x} ${p.y - p.size * 1.6} V${p.y + p.size * 1.6} M${p.x - p.size * 1.4} ${p.y} H${p.x + p.size * 1.4}`}
              stroke={s.particle.color}
              strokeWidth="0.7"
              style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
            />
          ) : (
            <circle key={`p${i}`} className="ms-p" cx={p.x} cy={p.y} r={p.size} fill={s.particle.color} style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
          ),
        )}
      </g>
      </Tiled>
    </svg>
  )
}
