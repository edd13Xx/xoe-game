import { WORLD_H, WORLD_W } from "../game/overworld.ts"
import { listMapEnvironments } from "./overworld-scenery.ts"
import { COLONY_BIOMES, biomeParticles } from "../game/colony-env.ts"

function Pill({ x, y, label, sub }: { x: number; y: number; label: string; sub?: string }) {
  const w = Math.max(72, label.length * 6.4 + 16)
  return (
    <g className="env-label" transform={`translate(${x}, ${y + 58})`}>
      <rect x={-w / 2} y={0} width={w} height={sub ? 28 : 18} rx="9" fill="rgba(11,13,18,0.72)" stroke="rgba(196,181,253,0.35)" />
      <text textAnchor="middle" y={13} fill="#f4f1ff" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">{label}</text>
      {sub ? <text textAnchor="middle" y={24} fill="#c4b5fd" fontSize="8" fontFamily="system-ui,sans-serif">{sub}</text> : null}
    </g>
  )
}

function Beam({ x, y, color, tall = 140 }: { x: number; y: number; color: string; tall?: number }) {
  return (
    <g className="env-beam" transform={`translate(${x}, ${y})`}>
      <polygon points={`-5,0 5,0 14,${-tall} -14,${-tall}`} fill={color} opacity="0.22" />
      <polygon points={`-1.5,0 1.5,0 3,${-tall} -3,${-tall}`} fill={color} opacity="0.55" />
    </g>
  )
}

function Mushroom({ x, y, cap, stem = "#c4b5fd" }: { x: number; y: number; cap: string; stem?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-3" y="-10" width="6" height="12" rx="2" fill={stem} />
      <ellipse cx="0" cy="-14" rx="11" ry="8" fill={cap} />
      <ellipse cx="-3" cy="-16" rx="3" ry="2" fill="rgba(255,255,255,0.35)" />
    </g>
  )
}

function Tree({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-2" y="-8" width="4" height="10" fill="#3a2a1c" />
      <circle cx="0" cy="-14" r="8" fill={color} />
      <circle cx="0" cy="-14" r="3" fill="#e8fff8" opacity="0.7" />
    </g>
  )
}

/** Three ambient motes in the colony's biome colour so the isle reads as the same place you fly into. */
function BiomeMotes({ id }: { id: string }) {
  const b = COLONY_BIOMES[id]!
  return (
    <g className="env-motes" data-biome-motes={id}>
      {biomeParticles(id, 3, 140, 70).map((p, i) => (
        <circle key={i} className="env-mote" cx={p.x - 70} cy={p.y - 70} r={p.size + 0.6} fill={b.particle.color} style={{ animationDelay: `${p.delay}s` }} />
      ))}
    </g>
  )
}

/** Original floating-land art for every colony, hub and both moons. Visual only. */
export function OverworldScenery() {
  const envs = listMapEnvironments()
  return (
    <svg className="overworld-scenery" width={WORLD_W} height={WORLD_H} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} aria-hidden="true">
      <defs>
        <radialGradient id="xoeSolDisk" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#fff6c8" />
          <stop offset="35%" stopColor="#ffb53a" />
          <stop offset="75%" stopColor="#ff5a14" />
          <stop offset="100%" stopColor="#6a0c00" />
        </radialGradient>
      </defs>
      {envs.map((env) => (
        <g key={env.id} className={`env-node env-${env.id}`} data-env={env.id} transform={`translate(${env.x}, ${env.y})`}>
          {artFor(env.id)}
          {COLONY_BIOMES[env.id] ? <BiomeMotes id={env.id} /> : null}
          {env.kind === "moon" ? <Pill x={0} y={8} label={env.name} sub="moon · path later" /> : null}
        </g>
      ))}
    </svg>
  )
}

function artFor(id: string) {
  switch (id) {
    case "wallet":
      return (
        <>
          <ellipse cx="0" cy="18" rx="78" ry="18" fill="rgba(0,0,0,0.28)" />
          <path d="M-86 8 C-70 -28 -20 -40 8 -32 C44 -22 70 -10 86 10 C60 28 10 36 -30 30 C-62 26 -86 18 -86 8Z" fill="#1f6a4a" />
          <path d="M-70 4 C-50 -22 -10 -30 20 -20 C50 -10 68 4 72 12 C40 20 -10 24 -48 16Z" fill="#2f9a68" />
          <path d="M-40 -8 C-20 -24 20 -20 36 -8 C10 -2 -20 0 -40 -8Z" fill="#56c48a" />
          <Mushroom x={-28} y={-6} cap="#9b7dff" />
          <Mushroom x={8} y={-2} cap="#c4b5fd" />
          <Mushroom x={36} y={4} cap="#7c5cff" />
          <Tree x={-52} y={2} color="#1ec8a0" />
          <Tree x={-8} y={-10} color="#3ef0c8" />
          <Tree x={52} y={6} color="#1ec8a0" />
          <rect x="18" y="-28" width="8" height="26" rx="2" fill="#d9c48a" />
          <Beam x={22} y={-28} color="#f5e27a" tall={150} />
        </>
      )
    case "keys":
      return (
        <>
          <ellipse cx="0" cy="16" rx="70" ry="14" fill="rgba(0,0,0,0.28)" />
          <path d="M-40 8 L-20 -18 L40 -22 L84 -4 L70 16 L-30 18 Z" fill="#2a3358" />
          <path d="M-20 -4 L8 -20 L54 -14 L62 2 L10 8 Z" fill="#3f4d7c" />
          <circle cx="-26" cy="-8" r="16" fill="none" stroke="#a8b4ff" strokeWidth="5" />
          <rect x="-4" y="-10" width="46" height="8" rx="3" fill="#c5d0ff" />
          <rect x="30" y="-16" width="6" height="8" fill="#c5d0ff" />
          <rect x="40" y="-16" width="6" height="8" fill="#c5d0ff" />
          <path d="M-8 -28 L-4 -48 L0 -28 Z" fill="#dbe4ff" />
          <path d="M16 -26 L20 -52 L24 -26 Z" fill="#9ad8ff" />
          <path d="M36 -22 L40 -44 L44 -22 Z" fill="#dbe4ff" />
        </>
      )
    case "blocks":
      return (
        <>
          <ellipse cx="0" cy="18" rx="72" ry="14" fill="rgba(0,0,0,0.28)" />
          <rect x="-70" y="0" width="50" height="18" fill="#8a6230" stroke="#d4a056" />
          <rect x="-30" y="-16" width="46" height="18" fill="#a67838" stroke="#e8c078" />
          <rect x="8" y="-32" width="44" height="18" fill="#c09048" stroke="#f0d090" />
          <rect x="28" y="-48" width="28" height="16" fill="#d4a056" stroke="#ffe2a8" />
          <path d="M-20 0 H16 M16 -16 H50" stroke="#f5d78a" strokeWidth="3" />
          <rect x="-58" y="4" width="8" height="8" fill="#6d9a4e" />
          <rect x="-44" y="4" width="8" height="8" fill="#6d9a4e" />
          <rect x="0" y="-10" width="8" height="8" fill="#6d9a4e" />
        </>
      )
    case "fees":
      return (
        <>
          <ellipse cx="0" cy="16" rx="80" ry="12" fill="rgba(0,0,0,0.25)" />
          <path d="M-90 6 C-40 -8 40 -8 90 6 L70 16 L-70 16 Z" fill="#8a4a32" />
          <path d="M-70 4 C-20 -10 20 -10 70 4 L60 10 L-60 10 Z" fill="#c56b45" />
          <path d="M-24 -4 H-16 V-28 H16 V-4 H24" fill="none" stroke="#e8b48a" strokeWidth="4" />
          <circle cx="-30" cy="-20" r="8" fill="none" stroke="#f0c070" strokeWidth="3" />
          <circle cx="30" cy="-20" r="8" fill="none" stroke="#f0c070" strokeWidth="3" />
          <rect x="-48" y="2" width="3" height="14" fill="#d4925a" />
          <rect x="-36" y="0" width="3" height="16" fill="#d4925a" />
          <rect x="36" y="0" width="3" height="16" fill="#d4925a" />
          <rect x="48" y="2" width="3" height="14" fill="#d4925a" />
        </>
      )
    case "stroops":
      return (
        <>
          <ellipse cx="-36" cy="16" rx="22" ry="8" fill="rgba(0,0,0,0.22)" />
          <ellipse cx="0" cy="20" rx="28" ry="10" fill="rgba(0,0,0,0.22)" />
          <ellipse cx="34" cy="14" rx="20" ry="8" fill="rgba(0,0,0,0.22)" />
          <ellipse cx="-36" cy="6" rx="24" ry="12" fill="#1f7a6a" />
          <ellipse cx="0" cy="8" rx="30" ry="14" fill="#2a9a80" />
          <ellipse cx="34" cy="4" rx="22" ry="11" fill="#1f7a6a" />
          <ellipse cx="58" cy="10" rx="12" ry="7" fill="#3cba98" />
          <ellipse cx="-58" cy="10" rx="10" ry="6" fill="#3cba98" />
          <circle cx="0" cy="-6" r="7" fill="#b8fff0" />
          <circle cx="0" cy="-6" r="16" fill="none" stroke="#7dffe8" strokeWidth="1.2" opacity="0.6" />
          <circle cx="0" cy="-6" r="24" fill="none" stroke="#7dffe8" strokeWidth="1" opacity="0.3" className="env-ripple" />
        </>
      )
    case "scams":
      return (
        <>
          <ellipse cx="0" cy="16" rx="70" ry="14" fill="rgba(0,0,0,0.3)" />
          <path d="M-72 8 C-40 -16 0 -10 20 -20 C50 -30 70 -4 64 14 C20 22 -30 24 -72 8Z" fill="#4a1520" />
          <path d="M-20 -2 L0 -18 L24 -8 L8 8 Z" fill="#6b1c28" />
          <path d="M-8 4 L40 0" stroke="#ff5a6a" strokeWidth="3" strokeDasharray="6 5" />
          <rect x="-12" y="-28" width="28" height="22" fill="#7a2430" stroke="#f0c070" />
          <polygon points=" -14,-28 2,-42 18,-28" fill="#c45a3a" />
          <rect x="2" y="-18" width="8" height="12" fill="#1a0a0c" />
          <path d="M-40 6 Q-30 -10 -18 4" fill="none" stroke="#2a0c12" strokeWidth="3" />
          <path d="M30 4 Q42 -12 54 6" fill="none" stroke="#2a0c12" strokeWidth="3" />
        </>
      )
    case "trustline":
      return (
        <>
          <ellipse cx="-36" cy="16" rx="34" ry="12" fill="rgba(0,0,0,0.24)" />
          <ellipse cx="36" cy="16" rx="34" ry="12" fill="rgba(0,0,0,0.24)" />
          <path d="M-70 8 C-60 -16 -20 -18 -12 8 C-30 18 -60 18 -70 8Z" fill="#dce8ff" />
          <path d="M12 8 C20 -18 60 -16 70 8 C60 18 30 18 12 8Z" fill="#dce8ff" />
          <path d="M-16 0 C-4 -14 4 -14 16 0" fill="none" stroke="#7ec8ff" strokeWidth="6" />
          <path d="M-16 0 C-4 -14 4 -14 16 0" fill="none" stroke="#eef8ff" strokeWidth="2" />
          <rect x="-28" y="-28" width="8" height="24" fill="#9ad0ff" />
          <rect x="20" y="-28" width="8" height="24" fill="#9ad0ff" />
          <Tree x={-40} y={0} color="#cfe4ff" />
          <Tree x={40} y={0} color="#cfe4ff" />
        </>
      )
    case "volatility":
      return (
        <>
          <ellipse cx="0" cy="16" rx="74" ry="13" fill="rgba(0,0,0,0.28)" />
          <path d="M-80 10 L-40 -8 L-10 12 L20 -22 L50 6 L82 0 L70 18 L-70 18 Z" fill="#3a1548" />
          <path d="M-40 -8 L-10 8 L20 -20 L36 -6" fill="none" stroke="#e879f9" strokeWidth="3" />
          <path d="M8 -36 L16 -8 L0 -14 L20 -40 L12 -8" fill="#f0e68c" stroke="#f5d76e" />
          <path d="M-60 8 Q-40 -6 -20 8" fill="none" stroke="#7c3aed" strokeWidth="2" />
          <path d="M24 8 Q44 -10 68 6" fill="none" stroke="#7c3aed" strokeWidth="2" />
        </>
      )
    case "phishing":
      return (
        <>
          <ellipse cx="8" cy="18" rx="70" ry="14" fill="rgba(0,0,0,0.28)" />
          <path d="M-30 8 C-10 -24 50 -28 78 -4 C84 10 40 24 -8 20 C-40 16 -48 10 -30 8Z" fill="#3d4a1a" />
          <path d="M-8 0 C16 -20 56 -16 68 0 C40 8 10 8 -8 0Z" fill="#5a6b24" />
          <path d="M-36 -8 C-60 -18 -70 8 -48 16 C-30 8 -24 2 -36 -8Z" fill="#2c3414" />
          <circle cx="16" cy="-28" r="8" fill="#d4ff6a" opacity="0.85" className="env-bait" />
          <path d="M16 -20 C16 -6 28 6 46 8" fill="none" stroke="#c4d36a" strokeWidth="2" />
          <path d="M-8 6 Q0 20 16 8" fill="none" stroke="#1c240c" strokeWidth="3" />
          <rect x="4" y="-8" width="16" height="12" rx="2" fill="#6a7a30" />
        </>
      )
    case "seed-backup":
      return (
        <>
          <ellipse cx="0" cy="18" rx="78" ry="14" fill="rgba(0,0,0,0.28)" />
          <path d="M-80 10 L-70 -16 L-20 -28 L40 -18 L80 8 L60 22 L-60 22 Z" fill="#3f4a3a" />
          <path d="M-50 -4 L-20 -22 L36 -14 L50 6 L-30 10 Z" fill="#5a6b4e" />
          <rect x="-18" y="-20" width="28" height="26" rx="2" fill="#6d7480" stroke="#d7dbe3" />
          <circle cx="-6" cy="-6" r="3" fill="#c9a227" />
          <Tree x={-48} y={0} color="#2f6b45" />
          <Tree x={48} y={4} color="#2f6b45" />
          <rect x="40" y="-36" width="8" height="28" fill="#c5c8ce" />
          <Beam x={44} y={-36} color="#d7e7ff" tall={130} />
        </>
      )
    case "daily-practice":
      return (
        <>
          <ellipse cx="0" cy="16" rx="60" ry="12" fill="rgba(0,0,0,0.22)" />
          <circle cx="0" cy="0" r="40" fill="#3d5a1e" />
          <circle cx="0" cy="0" r="30" fill="#f0c14a" opacity="0.85" />
          <circle cx="0" cy="0" r="14" fill="#fff3b0" />
          <path d="M0 -44 L4 -28 L0 -32 L-4 -28 Z" fill="#ffe08a" />
          <path d="M0 44 L4 28 L0 32 L-4 28 Z" fill="#ffe08a" />
          <path d="M44 0 L28 4 L32 0 L28 -4 Z" fill="#ffe08a" />
          <path d="M-44 0 L-28 4 L-32 0 L-28 -4 Z" fill="#ffe08a" />
          <rect x="-48" y="-6" width="3" height="16" fill="#f5d76e" />
          <rect x="45" y="-6" width="3" height="16" fill="#f5d76e" />
        </>
      )
    case "weekly-practice":
      return (
        <>
          <ellipse cx="0" cy="16" rx="64" ry="12" fill="rgba(0,0,0,0.25)" />
          <path d="M-20 16 A48 48 0 1 1 20 16 L8 12 A34 34 0 1 0 -8 12 Z" fill="#2a2158" />
          <path d="M-20 16 A48 48 0 1 1 20 16 L8 12 A34 34 0 1 0 -8 12 Z" fill="none" stroke="#8b7dff" strokeWidth="4" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const a = (-90 + i * (180 / 6)) * (Math.PI / 180)
            return <circle key={i} cx={Math.cos(a) * 38} cy={Math.sin(a) * 38} r="3.5" fill="#e2d9ff" />
          })}
          <circle cx="0" cy="-8" r="5" fill="#c4b5fd" />
          <Tree x={-28} y={10} color="#6b4a9a" />
          <Tree x={26} y={10} color="#6b4a9a" />
        </>
      )
    case "fees-leverage":
      return (
        <>
          <ellipse cx="8" cy="18" rx="70" ry="13" fill="rgba(0,0,0,0.28)" />
          <path d="M-60 16 L-20 -20 L80 -4 L50 22 L-50 22 Z" fill="#6a4020" transform="rotate(-8)" />
          <path d="M-20 -8 L50 2 L40 16 L-28 8 Z" fill="#8a5a2a" transform="rotate(-8)" />
          <rect x="-8" y="-28" width="8" height="36" fill="#c9a227" transform="rotate(-18)" />
          <rect x="-36" y="-4" width="70" height="6" fill="#e8c878" transform="rotate(-18)" />
          <circle cx="0" cy="6" r="22" fill="none" stroke="#c45a3a" strokeWidth="2" opacity="0.6" className="env-corona" />
        </>
      )
    case "harbor-commons":
      return (
        <>
          <ellipse cx="0" cy="18" rx="78" ry="14" fill="rgba(10,40,50,0.35)" />
          <path d="M-70 10 L-30 -8 L10 4 L40 -12 L70 12 L20 22 L-50 22 Z" fill="#1d4a52" />
          <rect x="-36" y="-6" width="10" height="22" fill="#c9a227" />
          <rect x="8" y="-10" width="8" height="24" fill="#7ce0d0" />
          <path d="M-60 12 L60 12 L50 20 L-50 20 Z" fill="#2a6b74" />
        </>
      )
    case "aurora-port":
      return (
        <>
          <ellipse cx="0" cy="18" rx="80" ry="14" fill="rgba(40,20,70,0.35)" />
          <path d="M-74 10 C-20 -22 20 -18 76 12 L50 22 L-50 22 Z" fill="#3a1d62" />
          <path d="M-40 -4 C-10 -28 20 -20 48 2" fill="none" stroke="#c4b5fd" strokeWidth="3" />
          <path d="M-24 4 C0 -24 30 -16 44 8" fill="none" stroke="#fb7185" strokeWidth="2" />
          <rect x="-8" y="-8" width="8" height="22" fill="#a78bfa" />
        </>
      )
    case "sol":
      return (
        <>
          <ellipse cx="0" cy="20" rx="86" ry="16" fill="rgba(80,20,0,0.35)" />
          <circle className="sol-star-disk" cx="6" cy="-22" r="38" fill="url(#xoeSolDisk)" />
          <circle cx="6" cy="-22" r="46" fill="none" stroke="rgba(255,160,40,0.35)" strokeWidth="3" className="env-corona" />
          <path d="M-90 10 L-50 -20 L-10 -8 L20 -36 L70 -10 L96 12 L60 24 L-70 24 Z" fill="#7a1c0c" />
          <path d="M-50 -20 L-10 -6 L20 -34 L50 -8 L30 6 L-30 4 Z" fill="#d35416" />
          <path d="M-20 -8 L20 -28 L44 -6" fill="#f39a3a" />
          <path d="M-16 -48 L0 -16 L16 -48 L8 -16 L0 -60 L-8 -16 Z" fill="#ffd27a" />
          <Beam x={0} y={-48} color="#ffb347" tall={160} />
          <path d="M-60 8 L-44 -4 L-28 8" fill="#e07030" />
          <path d="M48 6 L64 -8 L78 8" fill="#e07030" />
        </>
      )
    case "xelm":
      return (
        <>
          <ellipse cx="0" cy="18" rx="80" ry="15" fill="rgba(40,60,90,0.32)" />
          <path d="M-84 8 C-50 -24 -10 -16 10 -28 C40 -40 80 -8 86 10 C50 24 -20 26 -84 8Z" fill="#8aa2b8" />
          <path d="M-40 -4 C-10 -20 30 -24 54 -4 C20 6 -20 8 -40 -4Z" fill="#d5e6f2" />
          <circle cx="-28" cy="0" r="10" fill="#6e879a" />
          <circle cx="8" cy="-6" r="14" fill="#7690a4" />
          <circle cx="36" cy="4" r="8" fill="#6e879a" />
          <path d="M-8 -22 L-4 -52 L0 -22 Z" fill="#eef8ff" />
          <path d="M16 -18 L20 -58 L24 -18 Z" fill="#c9e7ff" />
          <path d="M32 -14 L36 -46 L40 -14 Z" fill="#eef8ff" />
          <path d="M-48 -6 L-44 -28 L-40 -6" fill="#c9e7ff" />
        </>
      )
    default:
      return <ellipse cx="0" cy="8" rx="48" ry="16" fill="#2a3350" />
  }
}
