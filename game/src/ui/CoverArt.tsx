import { GAME_FULL_NAME } from "../game/brand.ts"
/** In-code SVG cover for Unknown Orbital Engine. No legacy title art; no vendor logos. */
export function CoverArt({ className = "front-page" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 446"
      width={480}
      height={446}
      role="img"
      aria-label="XOE: Unknown Orbital Engine cover. A purple orb guide named XOE floats above a dark planet. The title reads XOE: Unknown Orbital Engine. Tagline: Now, in the palm of your hands."
      data-cover="unknown-orbital-engine-v6"
    >
      <defs>
        <radialGradient id="xoeCoverBg" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1a1530" />
          <stop offset="55%" stopColor="#0f1118" />
          <stop offset="100%" stopColor="#0b0d12" />
        </radialGradient>
        <radialGradient id="xoeOrbGlow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="40%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="rgba(124,92,255,0)" />
        </radialGradient>
        <radialGradient id="xoeOrbCore" cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f5f3ff" />
          <stop offset="35%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b3fd4" />
        </radialGradient>
        <linearGradient id="xoeHorizon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(167,139,250,0.55)" />
          <stop offset="100%" stopColor="rgba(11,13,18,0)" />
        </linearGradient>
      </defs>
      <rect width="480" height="446" fill="url(#xoeCoverBg)" />
      {/* stars */}
      <g fill="#a78bfa" opacity="0.85">
        <circle cx="48" cy="52" r="1.4" />
        <circle cx="92" cy="28" r="1" />
        <circle cx="140" cy="70" r="1.2" />
        <circle cx="220" cy="36" r="1" />
        <circle cx="310" cy="58" r="1.5" />
        <circle cx="380" cy="30" r="1" />
        <circle cx="430" cy="78" r="1.3" />
        <circle cx="60" cy="120" r="1" />
        <circle cx="410" cy="140" r="1.1" />
      </g>
      {/* planet rim */}
      <ellipse cx="240" cy="390" rx="260" ry="90" fill="url(#xoeHorizon)" />
      <path
        d="M-20 360 Q240 300 500 360 L500 446 L-20 446 Z"
        fill="#151822"
      />
      <path
        d="M0 358 Q240 292 480 358"
        fill="none"
        stroke="#7c5cff"
        strokeWidth="2.5"
        opacity="0.7"
      />
      {/* XOE purple orb */}
      <circle cx="240" cy="168" r="78" fill="url(#xoeOrbGlow)" opacity="0.9" />
      <circle cx="240" cy="168" r="52" fill="url(#xoeOrbCore)" />
      <circle cx="222" cy="150" r="14" fill="rgba(255,255,255,0.45)" />
      <text
        x="240"
        y="176"
        textAnchor="middle"
        fontFamily="Inter, Segoe UI, system-ui, sans-serif"
        fontSize="22"
        fontWeight="800"
        fill="#0b0d12"
      >
        XOE
      </text>
      {/* title (v18: the small tagline lines moved to real 16px HTML text under the menu title) */}
      <text
        x="240"
        y="268"
        textAnchor="middle"
        fontFamily="Inter, Segoe UI, system-ui, sans-serif"
        fontSize="26"
        fontWeight="700"
        fill="#f4f4f7"
      >
        {GAME_FULL_NAME}
      </text>
    </svg>
  )
}
