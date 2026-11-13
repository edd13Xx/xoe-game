import { useId } from "react"
import type { EnemyKind } from "../game/combat.ts"

/** Original enemy craft silhouettes for the fight field (decorative; the button carries the name). */
export function FightEnemySprite({ kind, color }: { kind: EnemyKind; color: string }) {
  const glowId = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  return (
    <svg className={`fight-enemy-craft craft-${kind}`} viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${glowId})`} />
      {kind === "phish-drone" ? (
        <g>
          {/* Lure drone: swept wings, a hook-shaped tail and a single red eye. */}
          <path d="M8 24 L22 14 L40 22 L40 26 L22 34 Z" fill="#1b1220" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 24 C4 24 3 30 7 32 C10 33 11 30 9 29" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M22 14 L26 8 M22 34 L26 40" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="24" r="3.6" fill="#ff2e4a" />
          <circle cx="33" cy="23" r="1.2" fill="#fff" />
        </g>
      ) : kind === "hack-probe" ? (
        <g>
          {/* Intrusion probe: hex core, three data spikes, scanning slit. */}
          <path d="M24 10 L36 17 L36 31 L24 38 L12 31 L12 17 Z" fill="#140f26" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M24 10 L24 3 M36 31 L42 35 M12 31 L6 35" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="3" r="1.8" fill="#78e6ff" />
          <rect x="16" y="22" width="16" height="4" rx="2" fill="#78e6ff" />
          <path d="M18 17 L30 17 M18 31 L30 31" stroke={color} strokeOpacity="0.6" strokeWidth="1.2" />
        </g>
      ) : (
        <g>
          {/* Swarm: five shard drones flying in a loose knot. */}
          {[
            [24, 12, 0],
            [12, 22, -20],
            [36, 22, 20],
            [17, 35, -10],
            [31, 35, 10],
          ].map(([x, y, r], i) => (
            <path
              key={i}
              d="M0 -6 L5 0 L0 6 L-5 0 Z"
              transform={`translate(${x} ${y}) rotate(${r})`}
              fill={i === 0 ? color : "#22190b"}
              stroke={color}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          ))}
          <circle cx="24" cy="25" r="2.2" fill="#fff4cf" />
        </g>
      )}
    </svg>
  )
}
