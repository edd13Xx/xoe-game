import { useCallback, useState } from "react"
import {
  buildReportContext,
  grokBugReportPrompt,
  templateBugReport,
  type ReportContext,
} from "../game/error-log.ts"
import { canAttemptLiveGrok, type GrokConnectSettings } from "../game/grok-connect-settings.ts"
import { sendLiveXaiGrokMessage } from "../game/grok-guest.ts"
import { storageBackendInfo } from "../game/safe-storage.ts"
import { DrawerShell } from "./DrawerShell.tsx"

export function ReportProblemPanel({
  open,
  onClose,
  grokConnect,
}: {
  open: boolean
  onClose: () => void
  grokConnect: GrokConnectSettings
}) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const build = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    const backend = storageBackendInfo()
    const ctx: ReportContext = buildReportContext({
      note,
      grokEnabled: grokConnect.enabled,
      hasKey: grokConnect.apiKey.trim().length > 0,
      storageBackend: `local=${backend.local};session=${backend.session}`,
    })
    let text = templateBugReport(ctx)
    if (canAttemptLiveGrok(grokConnect)) {
      setStatus("Asking Grok Bot for a plain-English report…")
      const live = await sendLiveXaiGrokMessage({
        text: grokBugReportPrompt(ctx),
        apiKey: grokConnect.apiKey,
        endpoint: grokConnect.endpoint,
        model: grokConnect.model,
      })
      if (live.ok && live.reply) {
        text = `${live.reply.trim()}\n\n---\nTechnical details\n${templateBugReport(ctx)}`
        setStatus("Report written with live Grok Bot help.")
      } else {
        setStatus("Live Grok Bot unavailable — using template report.")
      }
    } else {
      setStatus("Using template report (built-in).")
    }
    setReport(text)
    setBusy(false)
  }, [busy, note, grokConnect])

  async function copy() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report)
      setStatus("Copied. Paste it to Eddie when you can.")
    } catch {
      setStatus("Copy blocked — select the text and copy manually.")
    }
  }

  async function share() {
    if (!report) return
    try {
      if (navigator.share) {
        await navigator.share({ title: "XOE bug report", text: report })
        setStatus("Share sheet opened.")
      } else {
        await copy()
      }
    } catch {
      setStatus("Share canceled or unavailable.")
    }
  }

  return (
    <DrawerShell open={open} title="Report a problem" onClose={onClose} labelledBy="drawer-report-title">
      <section className="report-problem-panel">
      <p className="fine">
        Collects recent errors, build, screen, and browser info. Optional note below. Nothing sends by itself — you Copy
        or Share to Eddie. Grok Bot only advises; it cannot change the game code. Keys are never included.
      </p>
      <label className="name-field">
        What went wrong? (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. Start screen went blank on my iPhone"
          aria-label="Problem note"
        />
      </label>
      <button type="button" className="touch-btn primary" disabled={busy} onClick={() => void build()}>
        {busy ? "Building report…" : "Build report"}
      </button>
      {status ? (
        <p className="status-line" role="status">
          {status}
        </p>
      ) : null}
      {report ? (
        <>
          <pre className="report-pre" tabIndex={0}>
            {report}
          </pre>
          <div className="menu-row">
            <button type="button" className="touch-btn primary" onClick={() => void copy()}>
              Copy
            </button>
            <button type="button" className="touch-btn" onClick={() => void share()}>
              Share
            </button>
          </div>
        </>
      ) : null}
    </section>
    </DrawerShell>
  )
}
