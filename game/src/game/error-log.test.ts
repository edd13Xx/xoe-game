import { describe, expect, it, beforeEach } from "vitest"
import { clearErrorLog, getRecentErrors, logClientError, templateBugReport, buildReportContext } from "./error-log.ts"

describe("error-log", () => {
  beforeEach(() => clearErrorLog())

  it("scrubs xai keys from logged messages", () => {
    logClientError("manual", new Error("boom xai-ABCDEFGHIJKLMNOP rest"))
    const e = getRecentErrors()[0]
    expect(e.message).not.toMatch(/xai-ABCDEFGHIJKLMNOP/)
    expect(e.message).toContain("xai-[redacted]")
  })

  it("template report never includes a raw key field", () => {
    const ctx = buildReportContext({ note: "blank", grokEnabled: true, hasKey: true, storageBackend: "memory" })
    const text = templateBugReport(ctx)
    expect(text).toContain("Unknown Orbital Engine")
    expect(text).toMatch(/key present: yes/)
    expect(text).not.toMatch(/xai-[A-Za-z0-9]{8,}/)
  })
})
