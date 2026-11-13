import { useEffect, useState } from "react"
import {
  LEADERBOARD_TOP,
  type PersonalBestRun,
  readLeaderboard,
  resetLeaderboard,
  recordPersonalBest,
} from "../game/meta-progress.ts"
import { getLocalStore } from "../game/safe-storage.ts"
import { DrawerShell } from "./DrawerShell.tsx"
import { FounderBadge } from "./FounderBadge.tsx"
import { readLedger, rowHasFounderBadge, type RewardLedger } from "../game/reward-plan.ts"
import {
  createLeaderboardAdapter,
  readDisplayName,
  readLeaderboardOptIn,
  renamePlayerRows,
  writeDisplayName,
  writeLeaderboardOptIn,
  type LeaderboardEntry,
} from "../game/leaderboard-remote.ts"

function formatWhen(atMs: number): string {
  try {
    return new Date(atMs).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

export function HighScoreScreen({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [board, setBoard] = useState<PersonalBestRun[]>([])
  const [remote, setRemote] = useState<LeaderboardEntry[]>([])
  const [optIn, setOptIn] = useState(false)
  const [name, setName] = useState("Pilot")
  const [confirmReset, setConfirmReset] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [submitScore, setSubmitScore] = useState(50)
  const [me, setMe] = useState<RewardLedger | null>(null)

  useEffect(() => {
    if (!open) return
    const store = getLocalStore()
    setBoard(readLeaderboard(store))
    setOptIn(readLeaderboardOptIn(store))
    setName(readDisplayName(store))
    setMe(readLedger(store))
    setConfirmReset(false)
    setStatus(null)
    const api = createLeaderboardAdapter(store)
    void api.list().then(setRemote)
  }, [open])

  async function refreshRemote() {
    const api = createLeaderboardAdapter(getLocalStore())
    setRemote(await api.list())
  }

  async function submit() {
    const store = getLocalStore()
    if (!readLeaderboardOptIn(store)) {
      setStatus("Turn on opt-in to use the test leaderboard.")
      return
    }
    writeDisplayName(store, name)
    const l = readLedger(store)
    renamePlayerRows(store, l.playerId, name)
    const api = createLeaderboardAdapter(store)
    const res = await api.submit({
      displayName: name,
      score: submitScore,
      kind: "arcade",
      playerId: l.playerId,
      founder: l.founderBadge,
    })
    if (!res.ok) {
      setStatus(res.error)
      return
    }
    recordPersonalBest(store, submitScore, "Test submit")
    setBoard(readLeaderboard(store))
    setStatus("Submitted to test leaderboard (Testnet XOE · no real money).")
    await refreshRemote()
  }

  return (
    <DrawerShell open={open} title="High scores / Leaderboard" onClose={onClose} labelledBy="drawer-scores-title">
      <section className="high-score-screen" data-scores="private-and-test">
        <h3 className="fine">This device</h3>
        <p className="fine">Private top {LEADERBOARD_TOP}. Practice points only.</p>
        <ol className="local-leaderboard high-score-list">
          {board.length === 0 ? <li className="fine">No local scores yet.</li> : null}
          {board.map((row, i) => (
            <li key={`${row.atMs}-${i}`}>
              <strong>#{i + 1}</strong> {me?.founderBadge ? <FounderBadge small /> : null} · {row.score} pts
              {row.label ? ` · ${row.label}` : ""}
              {row.atMs ? ` · ${formatWhen(row.atMs)}` : ""}
            </li>
          ))}
        </ol>
        <div className="menu-row">
          {!confirmReset ? (
            <button type="button" className="touch-btn ghost" onClick={() => setConfirmReset(true)}>
              Reset local scores
            </button>
          ) : (
            <button
              type="button"
              className="touch-btn"
              onClick={() => {
                resetLeaderboard(getLocalStore())
                setBoard([])
                setConfirmReset(false)
              }}
            >
              Confirm reset (this device)
            </button>
          )}
        </div>

        <hr className="fine" />
        <h3>Test leaderboard</h3>
        <p className="fine" data-test-leaderboard="1">
          Online-shaped UI · local mock backend · Testnet XOE · no real money · no accounts · no email. Config hook ready for
          Supabase/Firebase later.
        </p>
        <label className="toggle-row">
          <span>Opt in to the test leaderboard</span>
          <button
            type="button"
            className="touch-btn"
            aria-pressed={optIn}
            onClick={() => {
              const next = !optIn
              writeLeaderboardOptIn(getLocalStore(), next)
              setOptIn(next)
            }}
          >
            {optIn ? "On" : "Off"}
          </button>
        </label>
        <label className="name-field">
          Display name (no email)
          <input
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            aria-label="Leaderboard display name"
          />
        </label>
        <label className="vol-row">
          <span>Practice score to submit</span>
          <input
            type="number"
            min={1}
            max={1000000}
            value={submitScore}
            onChange={(e) => setSubmitScore(Number(e.target.value) || 1)}
            aria-label="Practice score"
          />
        </label>
        <button type="button" className="touch-btn primary" disabled={!optIn} onClick={() => void submit()}>
          Submit to test board
        </button>
        {status ? (
          <p className="status-line" role="status">
            {status}
          </p>
        ) : null}
        <ol className="local-leaderboard high-score-list" data-remote-board="test">
          {remote.map((row, i) => (
            <li key={row.id}>
              <strong>#{i + 1}</strong> {me && rowHasFounderBadge(row, me) ? <FounderBadge small /> : null} ·{" "}
              {row.displayName} · {row.score} · {row.kind} · test
            </li>
          ))}
        </ol>
      </section>
    </DrawerShell>
  )
}
