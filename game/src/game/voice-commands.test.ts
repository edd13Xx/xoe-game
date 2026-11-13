import { describe, expect, it } from "vitest"
import { applyVoiceCommand, parseVoiceCommand } from "./voice-commands.ts"
import { readFightDifficulty } from "./combat.ts"
import { readMusicPreference } from "./music.ts"

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

describe("voice commands", () => {
  it("parses music down, order book, and easier", () => {
    const store = mem()
    const down = parseVoiceCommand("turn the music down", store)
    expect(down.type).toBe("music-volume")
    applyVoiceCommand(down, store)
    expect(readMusicPreference(store).saved.volume).toBeLessThan(0.35)
    const book = parseVoiceCommand("open the order book", store)
    expect(book.type).toBe("open-drawer")
    if (book.type === "open-drawer") expect(book.drawer).toBe("paper")
    const easy = parseVoiceCommand("make it easier", store)
    applyVoiceCommand(easy, store)
    expect(readFightDifficulty(store)).toBe("easy")
  })
})
