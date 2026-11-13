import { describe, expect, it } from "vitest"
import {
  SIDE_MISSIONS,
  awardSideMissionPoints,
  isDangerInputLocked,
  pickSideMission,
  readSideMissionPref,
  shouldOfferSideMission,
  writeSideMissionPref,
  noteColonyClearForSideMissions,
  markSideMissionOffered,
  SIDE_MISSION_PITY_CLEARS,
  readSideMissionCooldown,
} from "./side-missions.ts"

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

describe("side missions", () => {
  it("defaults on, awards device-only points, and never asks for a real seed", () => {
    const store = mem()
    expect(readSideMissionPref(store).enabled).toBe(true)
    writeSideMissionPref(store, { enabled: false })
    expect(shouldOfferSideMission(store, 3, () => 0, 1_000_000)).toBe(false)
    writeSideMissionPref(store, { enabled: true })
    markSideMissionOffered(store, 0)
    // within gap + low pity → blocked
    expect(shouldOfferSideMission(store, 2, () => 0.1, 1000)).toBe(false)
    // pity after N clears
    for (let i = 0; i < SIDE_MISSION_PITY_CLEARS; i++) noteColonyClearForSideMissions(store)
    expect(readSideMissionCooldown(store).clearsSinceOffer).toBeGreaterThanOrEqual(SIDE_MISSION_PITY_CLEARS)
    expect(shouldOfferSideMission(store, 5, () => 0.99, 1000)).toBe(true)
    const blob = SIDE_MISSIONS.map((m) => `${m.blurb} ${m.xoeAfter}`).join(" ")
    expect(blob).toMatch(/cold storage/i)
    expect(blob).not.toMatch(/enter your seed|paste your real/i)
    expect(blob).toMatch(/Testnet XOE|no real money/)
    const phish = pickSideMission(() => 0, "phishing")
    expect(phish.kind).toBe("phishing")
    expect(phish.choices?.some((c) => c.ok)).toBe(true)
    const hack = pickSideMission(() => 0, "remote-hack")
    expect(hack.kind).toBe("remote-hack")
    expect(hack.dangerBeats?.[0]).toMatch(/DANGER/)
    const board = awardSideMissionPoints(store, phish)
    expect(board.totalPoints).toBe(phish.points)
  })

  it("locks input during remote-hack danger and unlocks after", () => {
    expect(isDangerInputLocked("remote-hack", "danger")).toBe(true)
    expect(isDangerInputLocked("remote-hack", "done")).toBe(false)
    expect(isDangerInputLocked("remote-hack", "fight")).toBe(false)
    expect(isDangerInputLocked("remote-hack", "intro")).toBe(false)
    expect(isDangerInputLocked("phishing", "play")).toBe(false)
    expect(isDangerInputLocked("phishing", "danger")).toBe(false)
  })
})
