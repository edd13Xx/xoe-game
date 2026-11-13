/**
 * Irreversible moon path + optional powers/variants (Eddie).
 * Suggested: Xelm → Frost Lock / Freeze, Sol → Flare Dash / Speed Burst — not forced.
 */

export type MoonId = "moon-pair-a" | "moon-pair-b"
export type MoonPowerFamily = "frost-lock" | "flare-dash" | "none"
export type FrostVariantId = "freeze" | "slow-mo"
export type FlareVariantId = "speed-burst" | "blink" | "flare-shield"
export type MoonPowerId = MoonPowerFamily

export interface PowerVariant {
  id: string
  label: string
  help: string
  durationMs: number
  cooldownMs: number
}

export interface MoonPower {
  id: MoonPowerFamily
  label: string
  help: string
  variants: readonly PowerVariant[]
  defaultVariantId: string
}

export const FROST_LOCK_DURATION_MS = 3000
export const FROST_LOCK_COOLDOWN_MS = 15_000
export const SLOW_MO_DURATION_MS = 4000
export const SLOW_MO_COOLDOWN_MS = 14_000
export const FLARE_DASH_DURATION_MS = 1200
export const FLARE_DASH_COOLDOWN_MS = 10_000
export const BLINK_DURATION_MS = 200
export const BLINK_COOLDOWN_MS = 8_000
export const FLARE_SHIELD_DURATION_MS = 5000
export const FLARE_SHIELD_COOLDOWN_MS = 12_000

export const MOON_POWERS: readonly MoonPower[] = [
  {
    id: "frost-lock",
    label: "Frost Lock",
    help: "Cold Xelm-themed control. Pick Freeze or Slow-Mo.",
    defaultVariantId: "freeze",
    variants: [
      {
        id: "freeze",
        label: "Freeze",
        help: `Default. Freeze time, enemies, and hazards for exactly 3 seconds. Cooldown ${FROST_LOCK_COOLDOWN_MS / 1000}s.`,
        durationMs: FROST_LOCK_DURATION_MS,
        cooldownMs: FROST_LOCK_COOLDOWN_MS,
      },
      {
        id: "slow-mo",
        label: "Slow-Mo",
        help: `Slow-motion mode for ${SLOW_MO_DURATION_MS / 1000}s (hazards crawl). Cooldown ${SLOW_MO_COOLDOWN_MS / 1000}s.`,
        durationMs: SLOW_MO_DURATION_MS,
        cooldownMs: SLOW_MO_COOLDOWN_MS,
      },
    ],
  },
  {
    id: "flare-dash",
    label: "Flare Dash",
    help: "Fiery Sol-themed mobility/defense. Pick a variant.",
    defaultVariantId: "speed-burst",
    variants: [
      {
        id: "speed-burst",
        label: "Speed Burst",
        help: `Default. Short fiery burst (${FLARE_DASH_DURATION_MS / 1000}s); next clean hit hits harder. Cooldown ${FLARE_DASH_COOLDOWN_MS / 1000}s.`,
        durationMs: FLARE_DASH_DURATION_MS,
        cooldownMs: FLARE_DASH_COOLDOWN_MS,
      },
      {
        id: "blink",
        label: "Blink",
        help: `Teleport skip ahead a short distance (${BLINK_DURATION_MS}ms). Cooldown ${BLINK_COOLDOWN_MS / 1000}s.`,
        durationMs: BLINK_DURATION_MS,
        cooldownMs: BLINK_COOLDOWN_MS,
      },
      {
        id: "flare-shield",
        label: "Flare Shield",
        help: `Blocks one hit for ${FLARE_SHIELD_DURATION_MS / 1000}s. Cooldown ${FLARE_SHIELD_COOLDOWN_MS / 1000}s.`,
        durationMs: FLARE_SHIELD_DURATION_MS,
        cooldownMs: FLARE_SHIELD_COOLDOWN_MS,
      },
    ],
  },
  {
    id: "none",
    label: "No power",
    help: "Run this moon with no special power.",
    defaultVariantId: "none",
    variants: [
      {
        id: "none",
        label: "No power",
        help: "Pure pilot skill. No cooldown.",
        durationMs: 0,
        cooldownMs: 0,
      },
    ],
  },
] as const

export interface MoonPath {
  id: MoonId
  name: string
  look: string
  suggestedPowerId: MoonPowerId
  suggestedVariantId: string
  xoeLine: string
  nameStatus: "approved by Eddie"
}

export const MOON_PATHS: readonly MoonPath[] = [
  {
    id: "moon-pair-a",
    name: "Xelm",
    look: "Cold quiet ashglass craters and frost-lit key-spires. Security and silence.",
    suggestedPowerId: "frost-lock",
    suggestedVariantId: "freeze",
    xoeLine:
      "XO: Xelm watches the keys. Suggested Frost Lock → Freeze — optional. You can pick any power/variant or none.",
    nameStatus: "approved by Eddie",
  },
  {
    id: "moon-pair-b",
    name: "Sol",
    look: "Fiery ridge-glow and streaking ember trails. Speed and linked blocks.",
    suggestedPowerId: "flare-dash",
    suggestedVariantId: "speed-burst",
    xoeLine:
      "XO: Sol burns fast. Suggested Flare Dash → Speed Burst — optional. Blink or Flare Shield also fit, or none.",
    nameStatus: "approved by Eddie",
  },
] as const

export const MOON_POWER_STORAGE_KEY = "xoe.moonPowerChoice"
export const MOON_VARIANT_STORAGE_KEY = "xoe.moonPowerVariant"

export function moonById(id: string): MoonPath | null {
  return MOON_PATHS.find((moon) => moon.id === id) ?? null
}

export function powerById(id: string | null | undefined): MoonPower | null {
  if (!id) return null
  return MOON_POWERS.find((p) => p.id === id) ?? null
}

export function variantById(powerId: string | null | undefined, variantId: string | null | undefined): PowerVariant | null {
  const power = powerById(powerId)
  if (!power) return null
  const vid = variantId ?? power.defaultVariantId
  return power.variants.find((v) => v.id === vid) ?? power.variants[0] ?? null
}

export function suggestedPowerForMoon(moonId: MoonId): MoonPowerId {
  return moonById(moonId)?.suggestedPowerId ?? "none"
}

export function suggestedVariantForMoon(moonId: MoonId): string {
  return moonById(moonId)?.suggestedVariantId ?? "none"
}

export function readStoredMoonPower(store: { getItem: (k: string) => string | null } | null): MoonPowerId | null {
  if (!store) return null
  try {
    const raw = store.getItem(MOON_POWER_STORAGE_KEY)
    if (raw === "frost-lock" || raw === "flare-dash" || raw === "none") return raw
  } catch {
    return null
  }
  return null
}

export function readStoredMoonVariant(store: { getItem: (k: string) => string | null } | null): string | null {
  if (!store) return null
  try {
    return store.getItem(MOON_VARIANT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredMoonPower(
  store: { setItem: (k: string, v: string) => void } | null,
  powerId: MoonPowerId,
  variantId: string,
): boolean {
  if (!store) return false
  try {
    store.setItem(MOON_POWER_STORAGE_KEY, powerId)
    store.setItem(MOON_VARIANT_STORAGE_KEY, variantId)
    return true
  } catch {
    return false
  }
}

export function abilityReady(args: {
  power: MoonPower
  variant: PowerVariant
  lastUsedAtMs: number | null
  nowMs: number
}): boolean {
  if (args.power.id === "none") return false
  if (args.lastUsedAtMs == null) return true
  return args.nowMs - args.lastUsedAtMs >= args.variant.cooldownMs
}

export function frostLockActive(frostUntilMs: number | null, nowMs: number): boolean {
  return frostUntilMs != null && nowMs < frostUntilMs
}

export function flareDashActive(flareUntilMs: number | null, nowMs: number): boolean {
  return flareUntilMs != null && nowMs < flareUntilMs
}

export function slowMoActive(slowMoUntilMs: number | null, nowMs: number): boolean {
  return slowMoUntilMs != null && nowMs < slowMoUntilMs
}

export function flareShieldActive(shieldUntilMs: number | null, nowMs: number): boolean {
  return shieldUntilMs != null && nowMs < shieldUntilMs
}
