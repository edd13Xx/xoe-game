import { describe, expect, it } from "vitest"
import { VOICE_LIST_LIMIT, VOICE_REMINDER, listDeviceVoices, resolveVoiceChoice, voiceQualityScore } from "./voices.ts"
import { clearVoicePreference, readVoicePreference, writeVoicePreference } from "./voice-storage.ts"
import { GROK_UNAVAILABLE, sendGuestGrokMessage } from "./grok-guest.ts"

describe("device voices", () => {
  it("ranks, de-dupes, and caps the list at 10", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      voiceURI: `u${i}`,
      name: i === 0 ? "Samantha" : i === 1 ? "Sam" : `Voice${i}`,
      lang: i < 12 ? "en-US" : "fr-FR",
      default: i === 3,
      localService: i % 2 === 0,
    }))
    // duplicate Sam en-US with lower quality remote
    many.push({ voiceURI: "sam-remote", name: "Sam", lang: "en-US", default: false, localService: false })
    const listed = listDeviceVoices(many)
    expect(listed.length).toBeLessThanOrEqual(VOICE_LIST_LIMIT)
    expect(listed.length).toBe(10)
    expect(listed[0]?.name).toBe("Samantha")
    expect(listed.filter((v) => v.name === "Sam")).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toMatch(/call voice/i)
    expect(voiceQualityScore(many[0]!)).toBeGreaterThan(voiceQualityScore(many[5]!))
  })

  it("falls back when the saved voice is gone and when storage throws", () => {
    const voices = listDeviceVoices([
      { voiceURI: "keep", name: "Ada", lang: "en-GB", default: true, localService: true },
    ])
    const missing = resolveVoiceChoice(voices, { voiceURI: "gone", name: "Sam", lang: "en-US" })
    expect(missing.selected?.voiceURI).toBe("keep")
    expect(missing.notice).toMatch(/unavailable/i)
    expect(resolveVoiceChoice([], null).selected).toBeNull()
    const blocked = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    }
    expect(readVoicePreference(blocked).storageBlocked).toBe(true)
    expect(writeVoicePreference(blocked, { voiceURI: "a", name: "Ada", lang: "en" })).toBe(false)
    expect(clearVoicePreference(blocked)).toBe(false)
  })

  it("uses one reminder string for text and speech", () => {
    expect(VOICE_REMINDER).toBe(
      "Pilot, you can change this voice in Voice settings or reset it to the browser default.",
    )
    expect(VOICE_REMINDER).not.toMatch(/call voice|Grok Bot audio/i)
  })
})

describe("guest grok client", () => {
  it("does not invent a reply when the adapter is unavailable", async () => {
    const result = await sendGuestGrokMessage("hello", "guest-1", async () => {
      throw new Error("offline")
    })
    expect(result).toEqual({ ok: false, reply: null, status: GROK_UNAVAILABLE })
    const empty = await sendGuestGrokMessage("   ", "guest-1", async () => {
      throw new Error("should not send")
    })
    expect(empty.reply).toBeNull()
  })
})
