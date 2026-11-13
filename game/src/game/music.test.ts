import { describe, expect, it } from "vitest"
import {
  clampVolume,
  createMusicController,
  marsThemeHasAmbient,
  readMusicPreference,
  themeForPhase,
  writeMusicPreference,
} from "./music.ts"

describe("music", () => {
  it("clamps volume and persists preference", () => {
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(-1)).toBe(0)
    const store = new Map<string, string>()
    const prefStore = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    }
    expect(writeMusicPreference(prefStore, { enabled: false, volume: 0.5, ambientVolume: 0.2 })).toBe(true)
    expect(readMusicPreference(prefStore).saved).toEqual({ enabled: false, volume: 0.5, ambientVolume: 0.2 })
  })

  it("maps phases to themes and stays silent at blackout", () => {
    expect(themeForPhase("pilot-select", false)).toBe("title")
    expect(themeForPhase("colony-map", true)).toBe("mars")
    expect(themeForPhase("colony-lesson", true)).toBe("colony")
    expect(themeForPhase("ragnarok", true)).toBe("ragnarok")
    expect(themeForPhase("ending", true)).toBe("ending")
    expect(themeForPhase("blackout", true)).toBe("silence")
    const music = createMusicController()
    expect(music.isUnlocked()).toBe(false)
    music.setTheme("colony")
    expect(music.getTheme()).toBe("colony")
    music.setTheme("mars")
    expect(music.getTheme()).toBe("mars")
    music.stop()
    expect(music.getTheme()).toBe("silence")
  })

  it("defines a mars chiptune pattern with mute-safe controller", () => {
    const music = createMusicController()
    music.setEnabled(false)
    music.setTheme("mars")
    expect(music.getTheme()).toBe("mars")
    music.setEnabled(true)
    expect(music.getTheme()).toBe("mars")
  })

  it("maps fight and trade cues without changing the baseline route themes", () => {
    expect(themeForPhase("colony-map", true, { fight: true })).toBe("combat")
    expect(themeForPhase("colony-map", true, { trading: true })).toBe("trade")
    expect(themeForPhase("moon-choice", true)).toBe("story")
    expect(themeForPhase("moon-approach", true)).toBe("moon")
    expect(themeForPhase("colony-map", true, { town: true })).toBe("town")
    expect(themeForPhase("ending", true, { credits: true })).toBe("credits")
    expect(themeForPhase("practice", true)).toBe("trade")
    const music2 = createMusicController()
    music2.setTheme("moon")
    expect(music2.getTheme()).toBe("moon")
    music2.setTheme("town")
    expect(music2.getTheme()).toBe("town")
    music2.setTheme("credits")
    expect(music2.getTheme()).toBe("credits")
    music2.stop()
    const music = createMusicController()
    music.setTheme("combat")
    expect(music.getTheme()).toBe("combat")
    music.setTheme("story")
    expect(music.getTheme()).toBe("story")
    music.setRegion("wallet")
    music.setBossLayer(2)
    music.setMutedBySystem(true)
    music.stop()
  })

  it("documents a soft ambient layer under mars", () => {
    expect(marsThemeHasAmbient()).toBe(true)
  })

  it("exposes a separate mars ambient volume", () => {
    const music = createMusicController()
    expect(music.getAmbientVolume()).toBeGreaterThan(0)
    music.setAmbientVolume(0.1)
    expect(music.getAmbientVolume()).toBe(0.1)
    music.setAmbientVolume(2)
    expect(music.getAmbientVolume()).toBe(1)
  })
})

