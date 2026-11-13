/**
 * Shop sells HEALTH items only — no weapons.
 * Vault: +1% max health and starting balance per 100 vault coins, capped at +50%.
 */
import type { MetaProgress } from "./meta-progress.ts"
import { clampCoins, writeMeta } from "./meta-progress.ts"
import { maxHealthAtLevel } from "./class-stats.ts"

export const VAULT_BONUS_PER_100 = 0.01
export const VAULT_BONUS_CAP = 0.5

export interface HealthItem {
  id: string
  label: string
  heal: number
  cost: number
}

export const HEALTH_ITEMS: readonly HealthItem[] = [
  { id: "stim-small", label: "Small stim", heal: 25, cost: 15 },
  { id: "stim-med", label: "Med pack", heal: 50, cost: 35 },
  { id: "stim-full", label: "Full recharge", heal: 9999, cost: 60 },
] as const

export function vaultBonusFraction(vaultCoins: number): number {
  const steps = Math.floor(Math.max(0, vaultCoins) / 100)
  return Math.min(VAULT_BONUS_CAP, steps * VAULT_BONUS_PER_100)
}

export function effectiveMaxHealth(meta: MetaProgress): number {
  const base = maxHealthAtLevel(meta.pilotClass, meta.level)
  return Math.round(base * (1 + vaultBonusFraction(meta.vault)))
}

export function effectiveStartingBalance(meta: MetaProgress, pocketBase: number): number {
  return Math.round(pocketBase * (1 + vaultBonusFraction(meta.vault)))
}

/** Pay from pocket then vault; heal energy (practice health proxy). */
export function buyHealthItem(
  meta: MetaProgress,
  itemId: string,
): { meta: MetaProgress; healed: number } | null {
  const item = HEALTH_ITEMS.find((h) => h.id === itemId)
  if (!item) return null
  const need = item.cost
  let next = meta
  if (meta.coins >= need) {
    next = { ...meta, coins: clampCoins(meta.coins - need) }
  } else {
    const fromVault = need - meta.coins
    if (meta.vault < fromVault) return null
    next = { ...meta, coins: 0, vault: meta.vault - fromVault }
  }
  const before = next.energy
  next = { ...next, energy: Math.min(100, before + Math.min(item.heal, 100 - before)) }
  return { meta: next, healed: next.energy - before }
}

export function persistShopBuy(meta: MetaProgress, store: Storage | null): void {
  writeMeta(store, meta)
}

