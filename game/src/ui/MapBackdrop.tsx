import { useMemo } from "react"

/** Fixed, original backdrop: deep starfield, soft glow orbs, and a ringed gas planet. */
export function MapBackdrop({ reducedMotion = false, redDay = false }: { reducedMotion?: boolean; redDay?: boolean }) {
  const stars = useMemo(() => {
    const out: { x: number; y: number; r: number; o: number; c: string }[] = []
    let s = 7
    const rand = () => {
      s = (s * 16807) % 2147483647
      return (s % 1000) / 1000
    }
    const colors = ["#e8eeff", "#c4b5fd", "#78e6ff", "#f5c84c", "#f9a8d4"]
    for (let i = 0; i < 70; i++) {
      out.push({
        x: rand() * 100,
        y: rand() * 100,
        r: 0.3 + rand() * 1.3,
        o: 0.35 + rand() * 0.6,
        c: colors[Math.floor(rand() * colors.length)]!,
      })
    }
    return out
  }, [])

  return (
    <div className={`map-backdrop${redDay ? " is-red-day" : ""}`} aria-hidden="true" data-reduced={reducedMotion ? "1" : "0"}> 
      <svg className="map-backdrop-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="xoeSkyFall" cx="50%" cy="0%" r="90%">
            <stop offset="0%" stopColor="#152046" />
            <stop offset="55%" stopColor="#0b1024" />
            <stop offset="100%" stopColor="#07080f" />
          </radialGradient>
          <radialGradient id="xoeSkyFlare" cx="70%" cy="85%" r="90%">
            <stop offset="0%" stopColor="rgba(255, 90, 20, 0.55)" />
            <stop offset="40%" stopColor="rgba(180, 30, 10, 0.35)" />
            <stop offset="100%" stopColor="rgba(60, 0, 0, 0.2)" />
          </radialGradient>
          <radialGradient id="xoePlanetBody" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#d8c6ff" />
            <stop offset="35%" stopColor="#8b6cf0" />
            <stop offset="70%" stopColor="#4c2d8c" />
            <stop offset="100%" stopColor="#23143f" />
          </radialGradient>
          <linearGradient id="xoePlanetBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,220,255,0.0)" />
            <stop offset="40%" stopColor="rgba(180,120,255,0.35)" />
            <stop offset="60%" stopColor="rgba(40,16,70,0.45)" />
            <stop offset="100%" stopColor="rgba(255,200,230,0.0)" />
          </linearGradient>
          <radialGradient id="xoeOrbV" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(167,139,250,0.85)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0)" />
          </radialGradient>
          <radialGradient id="xoeOrbT" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(120,230,255,0.7)" />
            <stop offset="100%" stopColor="rgba(120,230,255,0)" />
          </radialGradient>
          <radialGradient id="xoeOrbA" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245,200,76,0.55)" />
            <stop offset="100%" stopColor="rgba(245,200,76,0)" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#xoeSkyFall)" />
        {redDay ? <rect width="100" height="100" fill="url(#xoeSkyFlare)" /> : null}
        {stars.map((st, i) => (
          <circle key={i} className={reducedMotion ? undefined : "map-star-twinkle"} cx={st.x} cy={st.y} r={st.r} fill={redDay ? ["#ffb089", "#ff7a4a", "#ffd6a0", "#ff8a5c", "#ffcca8"][i % 5] : st.c} opacity={st.o} style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
        <ellipse className={reducedMotion ? undefined : "map-glow-orb"} cx="12" cy="28" rx="10" ry="8" fill="url(#xoeOrbT)" />
        <ellipse className={reducedMotion ? undefined : "map-glow-orb"} cx="78" cy="18" rx="9" ry="7" fill="url(#xoeOrbA)" style={{ animationDelay: "1.2s" }} />
        <ellipse className={reducedMotion ? undefined : "map-glow-orb"} cx="40" cy="8" rx="8" ry="6" fill="url(#xoeOrbV)" style={{ animationDelay: "0.6s" }} />
        <g className="map-ringed-planet" transform="translate(78 36)">
          <ellipse cx="0" cy="2" rx="22" ry="5" fill="none" stroke="rgba(226,210,255,0.28)" strokeWidth="2.2" transform="rotate(-18)" />
          <ellipse cx="0" cy="2" rx="22" ry="5" fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.1" transform="rotate(-18)" />
          <circle cx="0" cy="0" r="14" fill="url(#xoePlanetBody)" />
          <ellipse cx="0" cy="0" rx="13.5" ry="13.5" fill="url(#xoePlanetBand)" />
          <ellipse cx="-4" cy="-5" rx="4" ry="2.2" fill="rgba(255,255,255,0.22)" />
          <ellipse cx="0" cy="2" rx="22" ry="5" fill="none" stroke="rgba(244,241,255,0.4)" strokeWidth="0.7" transform="rotate(-18)" clipPath="none" />
        </g>
      </svg>
    </div>
  )
}
