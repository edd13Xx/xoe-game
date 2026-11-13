/** v15 XOE coin: neon gold disc with the XOE "X" mark (in-code SVG, no logos). */
export function XoeCoin({ size = 26 }: { size?: number }) {
  return (
    <svg className="xoe-coin" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#1a1530" stroke="#f5c84c" strokeWidth="2" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#a78bfa" strokeWidth="1" />
      <path d="M8.4 8.4 15.6 15.6M15.6 8.4 8.4 15.6" stroke="#f5c84c" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
