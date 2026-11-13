/**
 * Account & Wallet (Stellar TESTNET only). No real value.
 * Feature-detect browser wallet extension; never import secret material.
 *
 * Config hook for issuer / asset (placeholders only — never Eddie’s real keys):
 * STELLAR_WALLET_CONFIG
 */

export const STELLAR_WALLET_STORAGE_KEY = "xoe.stellarWallet.v1"
export const STELLAR_NETWORK_LABEL = "Testnet — no real value"

/** Documented placeholders — replace before any real rewards. Never use owner keys here. */
export const STELLAR_WALLET_CONFIG = {
  network: "testnet" as const,
  horizonHost: "horizon-testnet.stellar.org",
  /** Placeholder issuer G… address for asset XOE on testnet. Not a live issuer. */
  xoeAssetCode: "XOE",
  xoeIssuerPlaceholder: "GPLACEHOLDERXOEISSUERTESTNETONLY0000000000000000000000",
  freighterHome: "freighter.app",
  note: "Before real rewards: legal/securities review, KYC/geo, issuer setup, Eddie approval.",
}

/**
 * v13 locks (Eddie, Nov 9, 2026): testnet only; claiming XOE rewards REQUIRES Freighter
 * (a pasted G-address can view, but cannot claim). Smallest unit 0.0000001 XOE (1 stroop).
 * v14 reward plan + local ledger live in reward-plan.ts. No payouts are wired.
 */
export const XOE_STROOPS_PER_XOE = 10_000_000
export const XOE_SMALLEST_UNIT = "0.0000001"
/** Integer stroops → "0.0100000" (7 decimals, no float rounding). */
export function formatXoe(stroops: number): string {
  const n = Math.max(0, Math.floor(stroops))
  const whole = Math.floor(n / XOE_STROOPS_PER_XOE)
  const frac = String(n % XOE_STROOPS_PER_XOE).padStart(7, "0")
  return `${whole}.${frac}`
}

/** Claiming needs a Freighter connection (extension source). Pasted G-address = view only. */
export function canClaimXoeRewards(state: WalletState): boolean {
  return state.linked?.source === "extension"
}

export function claimBlockReason(state: WalletState): string | null {
  if (!state.linked) return "Connect Freighter to claim. Testnet only."
  if (state.linked.source !== "extension") return "A pasted G-address can only view rewards. Connect Freighter to claim."
  return null
}

export type WalletLinkSource = "extension" | "paste" | "none"

export interface LinkedWallet {
  publicKey: string
  source: WalletLinkSource
  linkedAtMs: number
  displayName: string
}

export interface WalletState {
  linked: LinkedWallet | null
  /** Never store secrets — this flag only tracks if user tried to paste one (discarded). */
  rejectedSecretAttempt: boolean
}

type Store = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem?: (k: string) => void }

const EMPTY: WalletState = { linked: null, rejectedSecretAttempt: false }

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function crc16xmodem(bytes: number[]): number {
  let crc = 0x0000
  for (const b of bytes) {
    crc ^= b << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

function decodeBase32(s: string): number[] | null {
  const cleaned = s.toUpperCase().replace(/=+$/, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch)
    if (idx < 0) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return out
}

/** True if string looks like a Stellar secret seed (S…). Never accept these. */
export function looksLikeSecretKey(raw: string): boolean {
  const t = raw.trim()
  return /^S[A-Z2-7]{55}$/i.test(t)
}

/**
 * Validate ed25519 public StrKey (G…). Checksummed base32; version byte 6<<3.
 * No stellar-sdk dependency.
 */
export function isValidPublicGAddress(raw: string): boolean {
  const t = raw.trim()
  if (!/^G[A-Z2-7]{55}$/i.test(t)) return false
  if (looksLikeSecretKey(t)) return false
  const bytes = decodeBase32(t)
  // version (1) + ed25519 pubkey (32) + crc16 (2) = 35
  if (!bytes || bytes.length !== 35) return false
  const version = bytes[0]!
  if (version !== 6 << 3) return false
  const payload = bytes.slice(0, 33)
  const checksum = bytes[33]! | (bytes[34]! << 8)
  return crc16xmodem(payload) === checksum
}

export function readWalletState(store: Store | null): WalletState {
  if (!store) return { ...EMPTY }
  try {
    const raw = store.getItem(STELLAR_WALLET_STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw) as Partial<WalletState> & { secret?: string; seed?: string }
    // Hard refuse if anything secret-shaped was ever written
    if (typeof p.secret === "string" || typeof p.seed === "string") {
      store.setItem(STELLAR_WALLET_STORAGE_KEY, JSON.stringify(EMPTY))
      return { ...EMPTY, rejectedSecretAttempt: true }
    }
    const linked = p.linked
    if (linked && !isValidPublicGAddress(linked.publicKey)) {
      return { ...EMPTY }
    }
    return {
      linked: linked && isValidPublicGAddress(linked.publicKey)
        ? {
            publicKey: linked.publicKey.trim(),
            source: linked.source === "extension" || linked.source === "paste" ? linked.source : "paste",
            linkedAtMs: typeof linked.linkedAtMs === "number" ? linked.linkedAtMs : Date.now(),
            displayName: (linked.displayName || "Pilot").slice(0, 24),
          }
        : null,
      rejectedSecretAttempt: p.rejectedSecretAttempt === true,
    }
  } catch {
    return { ...EMPTY }
  }
}

function persist(store: Store | null, state: WalletState): void {
  if (!store) return
  try {
    const safe = {
      linked: state.linked
        ? {
            publicKey: state.linked.publicKey,
            source: state.linked.source,
            linkedAtMs: state.linked.linkedAtMs,
            displayName: state.linked.displayName,
          }
        : null,
      rejectedSecretAttempt: state.rejectedSecretAttempt,
    }
    store.setItem(STELLAR_WALLET_STORAGE_KEY, JSON.stringify(safe))
  } catch {
    /* ignore */
  }
}

export function linkPublicAddress(
  store: Store | null,
  raw: string,
  displayName: string,
  source: WalletLinkSource = "paste",
): { ok: true; state: WalletState } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (looksLikeSecretKey(trimmed) || /^S[A-Z2-7]/i.test(trimmed)) {
    const prev = readWalletState(store)
    const next = { ...prev, rejectedSecretAttempt: true }
    persist(store, next)
    return { ok: false, error: "Never paste a secret key or seed (S…). Only public G-addresses. Discarded." }
  }
  if (!isValidPublicGAddress(trimmed)) {
    return { ok: false, error: "That doesn’t look like a valid Stellar public G-address." }
  }
  const next: WalletState = {
    linked: {
      publicKey: trimmed,
      source,
      linkedAtMs: Date.now(),
      displayName: displayName.trim().slice(0, 24) || "Pilot",
    },
    rejectedSecretAttempt: false,
  }
  persist(store, next)
  return { ok: true, state: next }
}

export function disconnectWallet(store: Store | null): WalletState {
  const next: WalletState = { linked: null, rejectedSecretAttempt: false }
  persist(store, next)
  return next
}

/** Extension bridge — no npm package; detects injected API if present. */
export function isBrowserWalletExtensionAvailable(): boolean {
  if (typeof window === "undefined") return false
  const w = window as unknown as { freighterApi?: unknown; stellar?: { freighter?: unknown } }
  return Boolean(w.freighterApi || w.stellar?.freighter)
}

export async function requestBrowserWalletPublicKey(): Promise<
  { ok: true; publicKey: string } | { ok: false; error: string }
> {
  if (!isBrowserWalletExtensionAvailable()) {
    return { ok: false, error: "Wallet extension not found. On phone, install from freighter.app or paste a G-address." }
  }
  try {
    const w = window as unknown as {
      freighterApi?: {
        isConnected?: () => Promise<boolean>
        requestAccess?: () => Promise<string>
        getPublicKey?: () => Promise<string>
      }
    }
    const api = w.freighterApi
    if (!api) return { ok: false, error: "Wallet API missing." }
    if (api.requestAccess) {
      const key = await api.requestAccess()
      if (isValidPublicGAddress(key)) return { ok: true, publicKey: key.trim() }
    }
    if (api.getPublicKey) {
      const key = await api.getPublicKey()
      if (isValidPublicGAddress(key)) return { ok: true, publicKey: key.trim() }
    }
    return { ok: false, error: "Could not read a public G-address from the extension." }
  } catch {
    return { ok: false, error: "Wallet request failed or was denied." }
  }
}

export function horizonTestnetAccountUrl(publicKey: string): string {
  return ["https", "://", STELLAR_WALLET_CONFIG.horizonHost, "/accounts/", encodeURIComponent(publicKey)].join("")
}

export function storageContainsNoSecrets(store: Store | null): boolean {
  if (!store) return true
  try {
    const raw = store.getItem(STELLAR_WALLET_STORAGE_KEY) || ""
    if (/["']S[A-Z2-7]{55}["']/i.test(raw)) return false
    if (/"secret"\s*:/.test(raw) || /"seed"\s*:/.test(raw) || /"mnemonic"\s*:/.test(raw)) return false
    return true
  } catch {
    return true
  }
}
