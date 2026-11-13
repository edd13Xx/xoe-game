import { describe, expect, it } from "vitest"
import {
  isValidPublicGAddress,
  linkPublicAddress,
  looksLikeSecretKey,
  readWalletState,
  storageContainsNoSecrets,
  disconnectWallet,
} from "./stellar-wallet.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
  }
}

const VALID_G = "GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H"
const FAKE_S = "S" + "A".repeat(55)

describe("stellar wallet safety", () => {
  it("validates G-addresses, rejects S-keys, and never persists secrets", () => {
    expect(isValidPublicGAddress(VALID_G)).toBe(true)
    expect(isValidPublicGAddress("GSHORT")).toBe(false)
    expect(looksLikeSecretKey(FAKE_S)).toBe(true)
    const store = mem()
    const bad = linkPublicAddress(store, FAKE_S, "Pilot", "paste")
    expect(bad.ok).toBe(false)
    expect(storageContainsNoSecrets(store)).toBe(true)
    expect(readWalletState(store).linked).toBe(null)
    const ok = linkPublicAddress(store, VALID_G, "Pilot", "paste")
    expect(ok.ok).toBe(true)
    expect(readWalletState(store).linked?.publicKey).toBe(VALID_G)
    expect(storageContainsNoSecrets(store)).toBe(true)
    disconnectWallet(store)
    expect(readWalletState(store).linked).toBe(null)
  })
})

describe("v13 rewards locks: Freighter-only claim + 0.0000001 XOE unit", () => {
  it("formats stroops with 7 decimals and matches the sample tiers", async () => {
    const m = await import("./stellar-wallet.ts")
    expect(m.XOE_SMALLEST_UNIT).toBe("0.0000001")
    expect(m.formatXoe(1)).toBe("0.0000001")
    expect(m.formatXoe(100_000)).toBe("0.0100000")
    expect(m.formatXoe(500_000)).toBe("0.0500000")
    expect(m.formatXoe(25_000)).toBe("0.0025000")
    expect(m.formatXoe(12_345_678_9)).toBe("12.3456789")
  })

  it("only a Freighter (extension) link can claim; pasted G-address is view-only", async () => {
    const m = await import("./stellar-wallet.ts")
    const base = { rejectedSecretAttempt: false }
    const linked = (source: "extension" | "paste") => ({
      ...base,
      linked: { publicKey: "G", source, linkedAtMs: 0, displayName: "P" },
    })
    expect(m.canClaimXoeRewards({ ...base, linked: null })).toBe(false)
    expect(m.canClaimXoeRewards(linked("paste"))).toBe(false)
    expect(m.claimBlockReason(linked("paste"))).toMatch(/Freighter/)
    expect(m.canClaimXoeRewards(linked("extension"))).toBe(true)
    expect(m.claimBlockReason(linked("extension"))).toBeNull()
  })
})
