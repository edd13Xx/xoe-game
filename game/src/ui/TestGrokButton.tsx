import { useEffect, useState } from "react"
import { AI_NAME } from "../game/brand.ts"
import { readGrokConnectSettings } from "../game/grok-connect-settings.ts"
import { probeLiveGrokDetail } from "../game/grok-live-probe.ts"
import { liveState, onLiveStatus } from "../game/live-status.ts"
import { getLocalStore } from "../game/safe-storage.ts"

/** v18.2: shows what is answering right now and a one-tap "Test Grok Bot" with the real result or exact error. */
export function TestGrokButton({ compact = false }: { compact?: boolean }) {
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => onLiveStatus(() => setTick((n) => n + 1)), [])
  const live = liveState()
  async function run() {
    if (busy) return
    const settings = readGrokConnectSettings(getLocalStore())
    if (!settings.apiKey.trim()) {
      setMsg(`No ${AI_NAME} key saved on this device. Paste your xAI key in the menu (Pause → ${AI_NAME}).`)
      return
    }
    if (!settings.enabled) {
      setMsg(`${AI_NAME} is OFF. Turn it ON to use live answers.`)
      return
    }
    setBusy(true)
    setMsg(`Testing ${AI_NAME}… this can take up to 45 seconds.`)
    const d = await probeLiveGrokDetail(settings)
    setMsg(d.status === "live" ? `${AI_NAME} answered ✓ Live answers are on.` : d.message)
    setBusy(false)
  }
  return (
    <div className={`test-grok${compact ? " compact" : ""}`} data-live-state={live.state}>
      <p className={`live-indicator live-${live.state}`} role="status">
        <span className="live-dot" aria-hidden="true" /> {live.label}
      </p>
      <button type="button" className="touch-btn test-grok-btn" onClick={() => void run()} disabled={busy}>
        {busy ? "Testing… (up to 45 s)" : `Test ${AI_NAME}`}
      </button>
      {msg ? (
        <p className="fine test-grok-result" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
