import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return [path]
  })
}

const BANNED = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /EventSource/,
  /sendBeacon/,
  /https?:\/\//,
  /wss?:\/\//,
  /@stellar\/stellar-sdk/,
  /soroban/i,
  /freighter/i,
  /agentId/i,
  /bc-[0-9a-f]{8,}/i,
  /api\.x\.com/,
  /\bKAS\b/,
  /Casper/,
  /\bBTC\b/,
  /XENOCOIN/,
]

describe("offline runtime", () => {
  it("ships no remote calls, tickers, agent ids, or ledger SDK in the game source", () => {
    const files = [
      ...walk("src").filter(
        (file) => !file.endsWith(".test.ts") && !file.endsWith(".jpg") && !file.endsWith(".png") && !file.endsWith(".webp"),
      ),
      "index.html",
    ]
    const hits: string[] = []
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      const guestFetchOnly = file.endsWith("grok-guest.ts") || file.endsWith("xo-speech.ts")
      // v18 Grok Bot relay: talks only to the configured relay (local-only unless Eddie approves a public one).
      const relayClient = file.endsWith("grok-bot-relay.ts")
      const marketReadOnly =
        file.endsWith("market.ts") ||
        file.endsWith("MarketPanel.tsx") ||
        file.endsWith("live-ticker.ts") ||
        file.endsWith("LiveTicker.tsx") ||
        file.endsWith("paper-advanced.ts") ||
        file.endsWith("PaperAdvancedDrawer.tsx")
      const tickerDisplay =
        marketReadOnly ||
        file.endsWith("ShotHarness.tsx") ||
        file.endsWith("MusicSettings.tsx") ||
        // v13 ticker gameplay names the same 5 public ticker coins (Testnet XOE · no real money, no fetch)
        file.endsWith("ticker-play.ts") ||
        file.endsWith("ticker-play.test.ts")
      const walletTestnet =
        file.endsWith("stellar-wallet.ts") ||
        file.endsWith("AccountWalletDrawer.tsx") ||
        file.endsWith("ShotHarness.tsx")
      const connectSettings = file.endsWith("grok-connect-settings.ts")
      for (const pattern of BANNED) {
        if (guestFetchOnly && pattern.source === "fetch\\s*\\(") continue
        if (marketReadOnly && (pattern.source === "fetch\\s*\\(" || pattern.source === "https?:\\/\\/")) continue
        if (tickerDisplay && pattern.source === "\\bBTC\\b") continue
        // Stellar TESTNET wallet UI may name Freighter / horizon (feature-detect; no SDK dep; no secrets).
        if (walletTestnet && (pattern.source === "freighter" || pattern.source === "https?:\\/\\/" || pattern.source === "fetch\\s*\\("))
          continue
        if (connectSettings && pattern.source === "https?:\\/\\/") continue
        if (relayClient && (pattern.source === "fetch\\s*\\(" || pattern.source === "https?:\\/\\/")) continue
        if (pattern.test(text)) hits.push(`${file} matched ${pattern}`)
      }
    }
    expect(hits).toEqual([])
  })

  it("depends only on react/preact at runtime", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> }
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["preact", "react", "react-dom"])
  })
})
