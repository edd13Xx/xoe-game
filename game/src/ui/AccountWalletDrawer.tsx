import { useEffect, useState } from "react"
import { DrawerShell } from "./DrawerShell.tsx"
import { getLocalStore } from "../game/safe-storage.ts"
import { readDisplayName, renamePlayerRows, writeDisplayName } from "../game/leaderboard-remote.ts"
import { FounderBadge } from "./FounderBadge.tsx"
import { ECONOMY_SOURCES, SIM_USD_NOTE, SIM_USD_PER_XOE, formatPlay, formatXoe7, sumSources } from "../game/economy.ts"
import { readColonyBests } from "../game/colony-bests.ts"
import {
  FOUNDER_DAILY_CAP,
  FOUNDING_PILOT_SLOTS,
  MILESTONES,
  MONTHLY_POOL,
  NEW_PLAYER_DAILY_CAP,
  STREAK_DAYS,
  TOP10_SPLIT_XOE,
  XOE_TOTAL_SUPPLY_LABEL,
  dailyCap,
  readLedger,
  setFoundingSlotPlaceholder,
  streakMultiplier,
  type RewardLedger,
} from "../game/reward-plan.ts"
import {
  STELLAR_NETWORK_LABEL,
  STELLAR_WALLET_CONFIG,
  XOE_SMALLEST_UNIT,
  canClaimXoeRewards,
  claimBlockReason,
  formatXoe,
  disconnectWallet,
  isBrowserWalletExtensionAvailable,
  isValidPublicGAddress,
  linkPublicAddress,
  looksLikeSecretKey,
  readWalletState,
  requestBrowserWalletPublicKey,
  type WalletState,
} from "../game/stellar-wallet.ts"

export function AccountWalletDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<WalletState>(() => readWalletState(null))
  const [name, setName] = useState("Pilot")
  const [paste, setPaste] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [ext, setExt] = useState(false)
  const [ledger, setLedger] = useState<RewardLedger | null>(null)

  useEffect(() => {
    if (!open) return
    const store = getLocalStore()
    setState(readWalletState(store))
    setName(readDisplayName(store))
    setExt(isBrowserWalletExtensionAvailable())
    setLedger(readLedger(store))
    setStatus(null)
    setPaste("")
  }, [open])

  function saveName() {
    const store = getLocalStore()
    writeDisplayName(store, name)
    renamePlayerRows(store, readLedger(store).playerId, name)
    setStatus("Display name saved (no email). Your badge and scores follow you.")
  }

  function onPasteLink() {
    const store = getLocalStore()
    if (looksLikeSecretKey(paste) || paste.trim().startsWith("S")) {
      const res = linkPublicAddress(store, paste, name, "paste")
      setState(readWalletState(store))
      setStatus(res.ok ? null : res.error)
      setPaste("")
      return
    }
    const res = linkPublicAddress(store, paste, name, "paste")
    if (!res.ok) {
      setStatus(res.error)
      return
    }
    setState(res.state)
    setPaste("")
    setStatus("Linked public G-address (testnet).")
  }

  async function onConnectExt() {
    const got = await requestBrowserWalletPublicKey()
    if (!got.ok) {
      setStatus(got.error)
      return
    }
    const res = linkPublicAddress(getLocalStore(), got.publicKey, name, "extension")
    if (!res.ok) {
      setStatus(res.error)
      return
    }
    setState(res.state)
    setStatus("Connected via browser wallet extension (public key only).")
  }

  return (
    <DrawerShell open={open} title="Account & Wallet" onClose={onClose} labelledBy="drawer-wallet-title">
      <section className="wallet-panel" data-network="testnet">
        <p className="bad" role="status">
          {STELLAR_NETWORK_LABEL}
        </p>
        <p className="fine">
          Stellar testnet only. No real value. To claim XOE rewards you must connect Freighter — a pasted G-address alone
          can only view. The game never submits payouts; pending rewards are testnet / admin-only.
        </p>

        <h3>Player account</h3>
        <label className="name-field">
          Display name (no email)
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-label="Account display name" />
        </label>
        <button type="button" className="touch-btn ghost" onClick={saveName}>
          Save name
        </button>

        <h3>Connect Freighter (required to claim)</h3>
        {ext ? (
          <button type="button" className="touch-btn primary" onClick={() => void onConnectExt()}>
            Connect Freighter
          </button>
        ) : (
          <div className="panel" style={{ padding: 8 }}>
            <p className="fine">
              Freighter not detected. On desktop, install the Freighter browser wallet. On phones: open{" "}
              <a
                className="tap-link"
                href={["https", "://", STELLAR_WALLET_CONFIG.freighterHome].join("")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {STELLAR_WALLET_CONFIG.freighterHome}
              </a>{" "}
              for install how-to. You can paste a public G-address below to view rewards, but claiming needs Freighter.
            </p>
          </div>
        )}

        <label className="name-field">
          Paste public G-address (view only)
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="G…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Stellar public G-address"
          />
        </label>
        <button type="button" className="touch-btn" onClick={onPasteLink}>
          Link G-address
        </button>
        <p className="fine">Never paste a secret key or seed (S…). Those are rejected and discarded.</p>

        <h3>Create a wallet (guide)</h3>
        <ol className="fine">
          <li>Install Freighter (see link above) and switch it to Testnet.</li>
          <li>Create an account and back up the seed offline (paper/metal) — never photos/cloud.</li>
          <li>Practice that backup in the Seed Backup colony lesson.</li>
          <li>Return here and tap Connect Freighter (public key only). Claims need Freighter.</li>
        </ol>

        <h3>XOE trustline (testnet)</h3>
        <p className="fine">
          Asset code <strong>{STELLAR_WALLET_CONFIG.xoeAssetCode}</strong> · issuer (testnet config hook): <code className="fine">{STELLAR_WALLET_CONFIG.xoeIssuerPlaceholder.slice(0, 12)}…</code>
        </p>
        <p className="fine">A trustline lets your wallet hold XOE. Testnet only. The game never adds one.</p>

        <RewardsPanel ledger={ledger} onLedger={setLedger} />
        <button type="button" className="touch-btn" disabled title="Testnet only · payouts not wired">
          Claim (disabled · weekly batch placeholder)
        </button>
        <p className="fine" role="note">
          {claimBlockReason(state) ??
            (canClaimXoeRewards(state)
              ? "Freighter connected. Claims join the weekly testnet batch later — not wired yet."
              : "")}
        </p>

        <h3>Partner coins (coming soon)</h3>
        <p className="fine">Stellar-wrapped partner assets that could earn XOE rewards later — placeholder only.</p>

        {state.linked ? (
          <div className="panel" style={{ padding: 8, marginTop: 8 }}>
            <p className="fine">
              Linked ({state.linked.source}): {state.linked.publicKey.slice(0, 6)}…{state.linked.publicKey.slice(-4)}
            </p>
            <p className="fine">Valid G-address: {isValidPublicGAddress(state.linked.publicKey) ? "yes" : "no"}</p>
            <button type="button" className="touch-btn" onClick={() => setState(disconnectWallet(getLocalStore()))}>
              Disconnect wallet
            </button>
          </div>
        ) : (
          <p className="fine">No wallet linked.</p>
        )}

        {status ? (
          <p className="status-line" role="status">
            {status}
          </p>
        ) : null}
        {state.rejectedSecretAttempt ? (
          <p className="bad" role="alert">
            A secret/seed paste was rejected and not stored.
          </p>
        ) : null}
      </section>
    </DrawerShell>
  )
}

const x = formatXoe

/** v14 locked reward plan (testnet only). Local earned-but-unclaimed ledger in stroops. */
function RewardsPanel({ ledger, onLedger }: { ledger: RewardLedger | null; onLedger: (l: RewardLedger) => void }) {
  if (!ledger) return null
  const cap = dailyCap(ledger)
  const doubled = streakMultiplier(ledger.streak) > 1
  return (
    <section className="rewards-plan" data-rewards="v14">
      <h3>XOE rewards (testnet · locked plan)</h3>
      <p className="fine">
        Supply {XOE_TOTAL_SUPPLY_LABEL} XOE · smallest unit {XOE_SMALLEST_UNIT} · never real money · nothing live.
      </p>
      <div className="rewards-grid">
        <div>
          <span className="fine">Earned, unclaimed</span>
          <strong>{formatPlay(ledger.unclaimed)}</strong>
          <span className="fine">{x(ledger.unclaimed)} XOE</span>
        </div>
        <div>
          <span className="fine">Today</span>
          <strong>
            {formatPlay(ledger.todayCredited)} / {formatPlay(cap)}
          </strong>
          <span className="fine">{x(ledger.todayCredited)} / {x(cap)} XOE</span>
        </div>
        <div>
          <span className="fine">Streak</span>
          <strong>
            {ledger.streak}/{STREAK_DAYS} days {doubled ? "· ×2 on" : ""}
          </strong>
        </div>
      </div>
      <p className="fine">
        Daily caps: Founding Pilot {formatPlay(FOUNDER_DAILY_CAP)} ({x(FOUNDER_DAILY_CAP)} XOE) · new player {formatPlay(NEW_PLAYER_DAILY_CAP)} ({x(NEW_PLAYER_DAILY_CAP)} XOE). A {STREAK_DAYS}-day streak
        doubles earnings, up to your cap. A missed day resets it.
      </p>

      <EconomyPanel ledger={ledger} />

      <h3>Founding Pilot</h3>
      {ledger.founderBadge ? (
        <div className="founder-status" data-founder="earned">
          <FounderBadge />
          <p className="fine">Earned · gold ship trail unlocked · shows on every leaderboard · follows you if you rename.</p>
        </div>
      ) : (
        <p className="fine" data-founder="placeholder">
          First {FOUNDING_PILOT_SLOTS} pilots after mainnet launch who clear one colony. Status: not earned yet
          {ledger.foundingSlotPlaceholder ? " · founding slot (placeholder) on — clear a colony" : ""}.
        </p>
      )}
      <label className="toggle-row">
        <span className="fine">Founding slot placeholder (testnet/local test flag)</span>
        <button
          type="button"
          className="touch-btn ghost"
          aria-pressed={ledger.foundingSlotPlaceholder}
          onClick={() => {
            const store = getLocalStore()
            const cleared = Object.keys(readColonyBests(store)).length
            onLedger(setFoundingSlotPlaceholder(store, !ledger.foundingSlotPlaceholder, cleared))
          }}
        >
          {ledger.foundingSlotPlaceholder ? "On" : "Off"}
        </button>
      </label>
      <p className="fine">Cosmetic · not on Stellar · no XOE value.</p>

      <h3>Milestones (one-time, outside the daily cap)</h3>
      <ul className="fine">
        {MILESTONES.map((m) => (
          <li key={m.id}>
            {ledger.milestones.includes(m.id) ? "✓" : "○"} {m.label}: {x(m.stroops)} XOE
          </li>
        ))}
      </ul>

      <h3>Monthly top 10 · {x(MONTHLY_POOL)} XOE pool</h3>
      <p className="fine">
        Testnet leaderboard scores. Proposed split [Eddie to pick]: {TOP10_SPLIT_XOE.map((v, i) => `#${i + 1} ${v}`).join(" · ")}.
      </p>

      <p className="fine">
        Claims need Freighter · weekly testnet batch payouts, reviewed by hand.
      </p>
    </section>
  )
}

/** v15 Economy panel: earned by source, lifetime, supply context. Simulated USD display, ledger in stroops. */
function EconomyPanel({ ledger }: { ledger: RewardLedger }) {
  return (
    <section className="economy-panel" data-economy="v15" aria-label="Economy">
      <h3>Economy</h3>
      <p className="econ-warn">{SIM_USD_NOTE}</p>
      <p className="fine">
        Testnet XOE, play rewards, no cash value. Game-only display rate: 1 XOE = ${SIM_USD_PER_XOE}.00 sim. The XOE sim ticker floats around that rate in play.
      </p>
      <table className="econ-table">
        <tbody>
          {ECONOMY_SOURCES.map((src) => {
            const v = sumSources(ledger.bySource, src.keys)
            return (
              <tr key={src.label}>
                <th scope="row">{src.label}</th>
                <td>{formatPlay(v)}</td>
                <td className="fine">{formatXoe7(v)}</td>
              </tr>
            )
          })}
          <tr className="econ-total">
            <th scope="row">Lifetime earned</th>
            <td>{formatPlay(ledger.lifetime)}</td>
            <td className="fine">{formatXoe7(ledger.lifetime)}</td>
          </tr>
          <tr>
            <th scope="row">Unclaimed</th>
            <td>{formatPlay(ledger.unclaimed)}</td>
            <td className="fine">{formatXoe7(ledger.unclaimed)}</td>
          </tr>
        </tbody>
      </table>
      <p className="fine">
        Total supply {XOE_TOTAL_SUPPLY_LABEL} XOE (testnet) · monthly top-10 pool {x(MONTHLY_POOL)} XOE · daily cap today{" "}
        {formatPlay(dailyCap(ledger))}. Claim stays off · no payouts are wired.
      </p>
    </section>
  )
}
