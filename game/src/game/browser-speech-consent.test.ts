import { unlockAudioInGesture, setSoundMuted } from "./audio-unlock.ts"
import type { MusicController } from "./music.ts"
import { describe, it, expect, vi, afterEach } from "vitest"
import { browserSpeechEnabled, setBrowserSpeechEnabled, BROWSER_SPEECH_KEY } from "./browser-speech-consent.ts"
import { speakDeviceLine } from "./device-speech.ts"
import { getLocalStore } from "./safe-storage.ts"
afterEach(()=>{vi.restoreAllMocks();setBrowserSpeechEnabled(false);vi.unstubAllGlobals()})
describe("browser output consent",()=>{
 it("defaults off and does not even construct or speak an utterance",()=>{
  getLocalStore()?.removeItem(BROWSER_SPEECH_KEY)
  const speak=vi.fn();const construct=vi.fn()
  vi.stubGlobal("window",{speechSynthesis:{speak,cancel:vi.fn()}});vi.stubGlobal("SpeechSynthesisUtterance",construct)
  expect(browserSpeechEnabled()).toBe(false)
  setSoundMuted(false)
  unlockAudioInGesture({unlock:vi.fn()} as unknown as MusicController)
  expect(speakDeviceLine("private caption")).toBe(false)
  expect(construct).not.toHaveBeenCalled();expect(speak).not.toHaveBeenCalled()
 })
 it("revocation remains off in this tab even if persistent storage refuses the write",()=>{
  setBrowserSpeechEnabled(true)
  vi.spyOn(getLocalStore(),"setItem").mockImplementation(()=>{throw new Error("denied")})
  expect(setBrowserSpeechEnabled(false)).toBe(false)
  expect(browserSpeechEnabled()).toBe(false)
 })
 it("requires explicit opt-in and revocation cancels output",()=>{
  const cancel=vi.fn();vi.stubGlobal("window",{speechSynthesis:{cancel}})
  setBrowserSpeechEnabled(true);expect(browserSpeechEnabled()).toBe(true)
  setBrowserSpeechEnabled(false);expect(browserSpeechEnabled()).toBe(false);expect(cancel).toHaveBeenCalled()
 })
})
