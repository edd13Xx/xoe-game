import { describe, expect, it } from "vitest"
import { COLONIES } from "./colonies.ts"
import { buildOverworldNodes } from "./overworld.ts"

describe("v19 learning route", () => {
  it("keeps foundations, network safety, then advanced self-custody in a 3/3/4 split", () => {
    expect(COLONIES.map((c) => c.id)).toEqual(["wallet", "keys", "blocks", "fees", "stroops", "scams", "trustline", "volatility", "phishing", "seed-backup"])
    const story = buildOverworldNodes().filter((n) => n.kind === "colony")
    expect([1, 2, 3].map((ch) => story.filter((n) => n.chapter === ch).length)).toEqual([3, 3, 4])
    expect(story.map((n) => n.requiredLevel)).toEqual([1, 1, 1, 3, 3, 3, 5, 5, 5, 5])
  })
})
