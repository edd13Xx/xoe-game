/** Founding Pilot badge: gold neon wings with "888". Cosmetic only, not on Stellar. */
export function FounderBadge({ small = false }: { small?: boolean }) {
  const w = small ? 46 : 92
  return (
    <span className="founder-badge" data-founder-badge="888" role="img" aria-label="Founding Pilot badge, gold wings 888">
      <svg width={w} height={w * 0.42} viewBox="0 0 110 46" aria-hidden="true">
        <g fill="none" stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M38 24 C26 10 12 8 2 10 C10 14 14 18 16 22 C10 22 6 24 4 27 C14 27 22 30 30 34 Z" />
          <path d="M72 24 C84 10 98 8 108 10 C100 14 96 18 94 22 C100 22 104 24 106 27 C96 27 88 30 80 34 Z" />
        </g>
        <text x="55" y="31" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff3c4" stroke="#ffb020" strokeWidth=".6">
          888
        </text>
      </svg>
      {small ? null : <span className="founder-badge-label">Founding Pilot</span>}
    </span>
  )
}
