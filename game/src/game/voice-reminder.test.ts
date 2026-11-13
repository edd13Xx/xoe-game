import { describe, expect, it } from "vitest"
import {
  VOICE_REMINDER_COLONIES,
  VOICE_REMINDER_MIN_MS,
  markVoiceReminderShown,
  noteColonyClearForVoiceReminder,
  readVoiceReminderPref,
  setDontRemind,
  shouldShowVoiceReminder,
} from "./voice-reminder.ts"

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

describe("voice reminder cadence", () => {
  it("shows on first setup/play, respects dont-remind, fight/danger, and sparse cadence", () => {
    const store = mem()
    expect(shouldShowVoiceReminder(store, { screen: "setup", inFight: false, dangerMode: false })).toBe(true)
    markVoiceReminderShown(store, "setup", 1000)
    expect(readVoiceReminderPref(store).shownFirstStart).toBe(true)
    expect(shouldShowVoiceReminder(store, { screen: "setup", inFight: false, dangerMode: false, nowMs: 2000 })).toBe(false)
    expect(shouldShowVoiceReminder(store, { screen: "play", inFight: false, dangerMode: false, nowMs: 2000 })).toBe(true)
    markVoiceReminderShown(store, "play", 2000)
    expect(shouldShowVoiceReminder(store, { screen: "play", inFight: true, dangerMode: false, nowMs: 999999 })).toBe(false)
    expect(shouldShowVoiceReminder(store, { screen: "play", inFight: false, dangerMode: true, nowMs: 999999 })).toBe(false)
    for (let i = 0; i < VOICE_REMINDER_COLONIES; i++) noteColonyClearForVoiceReminder(store)
    expect(shouldShowVoiceReminder(store, { screen: "play", inFight: false, dangerMode: false, nowMs: 3000 })).toBe(true)
    markVoiceReminderShown(store, "play", 3000)
    expect(
      shouldShowVoiceReminder(store, {
        screen: "play",
        inFight: false,
        dangerMode: false,
        nowMs: 3000 + VOICE_REMINDER_MIN_MS,
      }),
    ).toBe(true)
    setDontRemind(store, true)
    expect(shouldShowVoiceReminder(store, { screen: "play", inFight: false, dangerMode: false, nowMs: 9e12 })).toBe(false)
  })
})
