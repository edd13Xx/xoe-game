import { useId } from "react"
import { GAME_FULL_NAME } from "../game/brand.ts"

// Original procedural scene: fixed seeds, no downloaded imagery, fonts, logos or network.
const unit = (i: number, salt: number) => {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return n - Math.floor(n)
}
const stars = Array.from({ length: 151 }, (_, i) => ({
  x: unit(i, 1) * 1200, y: unit(i, 7) * 630,
  r: i % 19 === 0 ? 2.1 : .45 + unit(i, 13) * 1.1,
  color: ["#adc7ff", "#f3dcb0", "#bda7fb", "#9cded5", "#e8b7cd"][i % 5],
}))

/** Planet crown is the image centre; its exact spherical limb drops toward both edges. */
export function OrbitalCover() {
  const id = useId().replace(/:/g, "")
  const ref = (name: string) => `url(#${id}-${name})`
  const label = `${GAME_FULL_NAME}. XO above a close spherical planetary crown, lit atmosphere and a purple arrow orbit. A monumental spiritual-mechanical destroyer approaches behind naturally scattered colored stars.`
  return <div className="front-page orbital-cover" role="img" aria-label={label} data-cover="unknown-orbital-engine-v19">
    <svg className="orbital-cover-static" viewBox="0 0 1200 760" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-space`} cx="68%" cy="22%" r="82%">
        <stop stopColor="#252439" /><stop offset=".5" stopColor="#0b1220" /><stop offset="1" stopColor="#05080f" />
      </radialGradient>
      <radialGradient id={`${id}-dawn`}><stop stopColor="#faf0d3" stopOpacity=".65" /><stop offset=".1" stopColor="#c6dfed" stopOpacity=".2" /><stop offset="1" stopColor="#95bfe0" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-planet`} gradientUnits="userSpaceOnUse" cx="360" cy="415" r="950">
        <stop stopColor="#91b3bf" /><stop offset=".15" stopColor="#496c7b" /><stop offset=".45" stopColor="#1b3444" /><stop offset=".72" stopColor="#101829" /><stop offset="1" stopColor="#050910" />
      </radialGradient>
      <linearGradient id={`${id}-night`} x1="0" y1="0" x2="1" y2=".5"><stop stopColor="#040713" stopOpacity="0" /><stop offset=".48" stopColor="#040713" stopOpacity=".05" /><stop offset="1" stopColor="#040713" stopOpacity=".76" /></linearGradient>
      <linearGradient id={`${id}-limb`} gradientUnits="userSpaceOnUse" x1="140" y1="380" x2="1180" y2="600">
        <stop stopColor="#f8ebd4" /><stop offset=".25" stopColor="#bbe6f4" /><stop offset=".58" stopColor="#7588cc" /><stop offset="1" stopColor="#4d3491" stopOpacity=".2" />
      </linearGradient>
      <linearGradient id={`${id}-alloy`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a7a2c1" /><stop offset=".18" stopColor="#3c3b58" /><stop offset=".55" stopColor="#0c1422" /><stop offset=".85" stopColor="#3e3855" /><stop offset="1" stopColor="#0b0d17" /></linearGradient>
      <linearGradient id={`${id}-dark-alloy`}><stop stopColor="#121825" /><stop offset=".42" stopColor="#090c15" /><stop offset=".6" stopColor="#242437" /><stop offset="1" stopColor="#080c15" /></linearGradient>
      <linearGradient id={`${id}-type`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fcfaff" /><stop offset=".55" stopColor="#e4ddff" /><stop offset="1" stopColor="#9182dc" /></linearGradient>
      <radialGradient id={`${id}-aura`}><stop stopColor="#8c71e8" stopOpacity=".48" /><stop offset=".4" stopColor="#6b51bd" stopOpacity=".12" /><stop offset="1" stopColor="#7c5cff" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${id}-orb`} cx="32%" cy="22%" r="85%"><stop stopColor="#f3edff" /><stop offset=".18" stopColor="#c0a8fa" /><stop offset=".48" stopColor="#7853c8" /><stop offset=".8" stopColor="#382661" /><stop offset="1" stopColor="#15152c" /></radialGradient>
      <filter id={`${id}-relief`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".009 .028" numOctaves="4" seed="83" result="height" />
        <feDiffuseLighting in="height" surfaceScale="8" diffuseConstant="1.15" lightingColor="#b1cbd4"><feDistantLight azimuth="226" elevation="24" /></feDiffuseLighting>
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id={`${id}-clouds`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".005 .024" numOctaves="3" seed="29" />
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 3 -1.6" result="cloud" />
        <feFlood floodColor="#d5e5ed" /><feComposite in2="cloud" operator="in" />
      </filter>
      <clipPath id={`${id}-surface`}><circle cx="600" cy="1720" r="1340" /></clipPath>
    </defs>
    <path d="M0 0h1200v760H0z" fill={ref("space")} />
    <ellipse cx="260" cy="409" rx="320" ry="245" fill={ref("dawn")} />
    {/* A reliquary-like machine, not a franchise silhouette: broken halo, articulated mantle,
        suspended spine and inward talons. Its mass eclipses the light, not XO's focal mark. */}
    <g transform="translate(895 204) rotate(-9)" data-cover-entity="original-reliquary">
      <ellipse rx="230" ry="250" fill={ref("aura")} opacity=".24" />
      <circle r="165" fill="none" stroke="#a59ac1" strokeOpacity=".2" strokeWidth="12" strokeDasharray="205 35 64 70" />
      <circle r="174" fill="none" stroke="#b6a6d4" strokeOpacity=".5" strokeWidth="1.4" strokeDasharray="240 58 72 80" />
      {Array.from({ length: 17 }, (_, i) => <path key={i} d="M0-151v-15" transform={`rotate(${i * 21.17})`} stroke="#b6a6d4" strokeOpacity={i % 3 ? ".22" : ".65"} strokeWidth={i % 3 ? "2" : "5"} />)}
      <path d="M-30-129-76-85-128-78-161-123-217-147-193-66-248-19-292 109-231 81-186 32-145 48-112 15-83 82-62 149-24 204 4 257 30 193 64 148 78 58 127 20 170 63 233 96 215-7 169-69 180-131 123-106 79-73 39-125 13-74Z" fill={ref("dark-alloy")} stroke="#8d7ca9" strokeWidth="2.4" />
      <path d="m-217-147 65 103-24 69-55 56 31-88 42-63M180-131  -7 62 64 148 78 58 127 20 170 63 144-4 169-69" fill={ref("alloy")} stroke="#776985" strokeWidth="1.5" />
      <path d="m-127-77 28 38-13 54-33 33-41-16M39-125 24-68 55-34 79-73M-83 82-46 102-24 204M78 58 42 88 30 193" fill="none" stroke="#b4a5c8" strokeOpacity=".5" strokeWidth="2" />
      <path d="M-25-94-39-45-20 7-28 54 0 100 25 48 15 4 35-44 19-92-2-65Z" fill="#070b13" stroke="#b8a3c5" strokeWidth="2" />
      <path d="m-13-37 12 17 13-20-8 53-6 22-7-23Z" fill="#d8a4dd" />
      <ellipse cy="2" rx="29" ry="44" fill="none" stroke="#d3aad9" strokeOpacity=".16" strokeWidth="12" />
      <path d="m-5-30 3 48 4-49" stroke="#fff0e4" strokeWidth="2" fill="none" />
      <path d="M-28 54 0 68 25 48M-17 92 0 110 16 90M-12 125 1 137 13 124" fill="none" stroke="#9b8cab" strokeWidth="3" />
      <path d="m-199-64-18 33-28 9M144-4l33 11 25 30M-69 110l23 33 11 44M51 112l-12 33-8 29" fill="none" stroke="#c2a6d5" strokeOpacity=".48" strokeWidth="2.4" />
      <path d="m-248-19 14 29-26 61M215-7-19 39 24 49" fill="none" stroke="#a17d9a" strokeWidth="2" />
    </g>
    {/* Exact near-surface sphere; static relief/cloud layers and double-stroke scattering. */}
    <circle cx="600" cy="1720" r="1340" fill="none" stroke={ref("limb")} strokeWidth="37" opacity=".08" />
    <circle cx="600" cy="1720" r="1340" fill="none" stroke={ref("limb")} strokeWidth="15" opacity=".2" />
    <circle cx="600" cy="1720" r="1340" fill={ref("planet")} />
    <g clipPath={ref("surface")}>
      <rect x="0" y="375" width="1200" height="385" fill="#6e99ac" filter={ref("relief")} opacity=".28" style={{ mixBlendMode: "soft-light" }} />
      <rect x="0" y="375" width="1200" height="385" filter={ref("clouds")} opacity=".23" />
      <path d="M-90 726Q180 430 397 491T944 586T1310 749M-80 751Q265 513 456 591T1159 704" fill="none" stroke="#c1d4df" strokeOpacity=".07" strokeWidth="15" />
      <path d="M-60 508q182-101 313-88l83 26 43-16 55 24-55 30-66-7-31 24-76-9-88 42-54-4Z" fill="#142e36" opacity=".23" />
      <path d="M20 752Q237 584 450 642T1070 749" fill="none" stroke="#080f1d" strokeOpacity=".22" strokeWidth="74" />
      <rect x="0" y="375" width="1200" height="385" fill={ref("night")} />
    </g>
    <circle cx="600" cy="1720" r="1340" fill="none" stroke={ref("limb")} strokeWidth="2.6" />
    {/* Original violet orb with teal force-field/gimbal. No weapons and no stat labels. */}
    <ellipse cx="520" cy="236" rx="245" ry="221" fill={ref("aura")} />
    <ellipse cx="549" cy="464" rx="366" ry="69" transform="rotate(-13 549 464)" fill="none" stroke="#7c5cff" strokeWidth="15" opacity=".12" />
    <ellipse cx="549" cy="464" rx="366" ry="69" transform="rotate(-13 549 464)" fill="none" stroke="#a78bfa" strokeWidth="3" opacity=".85" />
    <ellipse cx="549" cy="464" rx="366" ry="69" transform="rotate(-13 549 464)" fill="none" stroke="#e4d9ff" strokeWidth=".8" opacity=".7" />
    <path d="m853 350 48-12-19 42-2-21Z" fill="#dbc9ff" stroke="#7c5cff" strokeWidth="12" strokeOpacity=".2" />
    <path d="m853 350 48-12-19 42-2-21Z" fill="#eee6ff" stroke="#c4a9ff" strokeWidth="2" />
    <text x="520" y="429" textAnchor="middle" fill={ref("type")} stroke="#0a0d1b" strokeWidth="8" paintOrder="stroke" fontFamily="system-ui, sans-serif" fontSize="126" fontWeight="800" letterSpacing="16">XOE</text>
    <path d="M35 35h66M35 35v32M1165 725h-66M1165 725v-32" stroke="#b6a5ce" strokeOpacity=".3" strokeWidth="1.5" fill="none" />
    </svg>
    <svg className="orbital-cover-fx" viewBox="0 0 1200 760" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-alloy-fx`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a7a2c1" /><stop offset=".18" stopColor="#3c3b58" /><stop offset=".55" stopColor="#0c1422" /><stop offset=".85" stopColor="#3e3855" /><stop offset="1" stopColor="#0b0d17" /></linearGradient>
        <radialGradient id={`${id}-orb-fx`} cx="32%" cy="22%" r="85%"><stop stopColor="#f3edff" /><stop offset=".18" stopColor="#c0a8fa" /><stop offset=".48" stopColor="#7853c8" /><stop offset=".8" stopColor="#382661" /><stop offset="1" stopColor="#15152c" /></radialGradient>
      </defs>
      <g>{stars.map((s, i) => <g key={i}>
        {i % 19 === 0 && <circle cx={s.x} cy={s.y} r={s.r * 3.5} fill={s.color} opacity=".06" />}
        <circle cx={s.x} cy={s.y} r={s.r} fill={s.color} className="orbital-star"
          style={{ animationDelay: `${-unit(i, 11) * 13}s`, animationDuration: `${5 + unit(i, 17) * 7}s` }} />
      </g>)}</g>
      <g className="orbital-xo">
        <path d="m479 163-69 37-45 86 74-23 26 61 55 35 55-35 26-61 74 23-45-86-69-37" fill={`url(#${id}-alloy-fx)`} stroke="#b6a2df" strokeWidth="2.5" />
        <path d="m410 200-26 62 55-16 26 48M630 200l26 62-55-16-26 48M479 163l41-32 41 32" fill="none" stroke="#d6c7eb" strokeOpacity=".65" strokeWidth="2" />
        <circle cx="520" cy="229" r="71" fill={`url(#${id}-orb-fx)`} />
        <path d="m464 203 56 19 56-19-16 35-40 15-40-15Z" fill="#0b1424" stroke="#39425c" strokeWidth="2" />
        <path d="m480 222 40 14 40-14" fill="none" stroke="#79f6e1" strokeWidth="5" />
        <path d="m480 222 40 14 40-14" fill="none" stroke="#d4fff2" strokeWidth="1.2" />
        <path d="m485 176q23-18 47-10" fill="none" stroke="#eee2ff" strokeOpacity=".8" strokeWidth="3" />
        <circle cx="520" cy="229" r="88" fill="none" stroke="#89e6e1" strokeOpacity=".32" strokeWidth="1.8" />
        <circle cx="520" cy="229" r="96" fill="none" stroke="#b9a1e6" strokeOpacity=".3" strokeDasharray="14 25" />
      </g>
    </svg>
  </div>
}
