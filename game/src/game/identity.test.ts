import { describe, expect, it } from "vitest"
import { DEFAULT_NAME, ROLE, PILOTS } from "./content.ts"
import { createOpening, openingReducer } from "./opening.ts"

describe("Role, Pilot, and Name independence", () => {
  it("keeps Role, Pilot (character), and Name as separate fields", () => {
    expect(ROLE).toBe("Pilot")
    let s = createOpening()
    expect(s.playerName).toBe(DEFAULT_NAME)
    expect(DEFAULT_NAME).toBe("XO")
    expect(s.characterId).toBe("xoe")
    expect(PILOTS.find((p) => p.id === "xoe")?.name).toBe("XO")

    s = openingReducer(s, { type: "choose-character", characterId: "mara-venn" })
    expect(s.characterId).toBe("mara-venn")
    expect(s.playerName).toBe(DEFAULT_NAME) // name unchanged when pilot changes

    s = openingReducer(s, { type: "set-player-name", name: "Eddie" })
    expect(s.playerName).toBe("Eddie")
    expect(s.characterId).toBe("mara-venn") // pilot unchanged when name changes
    expect(ROLE).toBe("Pilot") // role constant never changes

    s = openingReducer(s, { type: "choose-character", characterId: "xoe" })
    expect(s.characterId).toBe("xoe")
    expect(s.playerName).toBe("Eddie")
  })
})
