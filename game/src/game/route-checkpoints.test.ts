import { describe, it, expect } from "vitest"
import { initialMeta, xpToNextLevel } from "./meta-progress.ts"
import { statsAtLevel } from "./class-stats.ts"
import { routeCheckpoint, settleRouteCheckpoints } from "./route-checkpoints.ts"
describe("approved route checkpoint option B", () => {
 it("raises fresh Blocks to 3 and Scams to 5 with XP zero and existing class growth", () => {
  for (const cls of ["Sentinel", "Striker", "Recon"] as const) {
   const original = { ...initialMeta(cls), xp: 75, coins: 17, vault: 42 }
   const blocks = routeCheckpoint(original, "blocks")
   expect(blocks).toMatchObject({ level: 3, xp: 0, coins: 17, vault: 42, def: statsAtLevel(cls, 3).def, off: statsAtLevel(cls, 3).off })
   const scams = routeCheckpoint(blocks, "scams")
   expect(scams).toMatchObject({ level: 5, xp: 0, coins: 17, vault: 42, def: statsAtLevel(cls, 5).def, off: statsAtLevel(cls, 5).off })
   expect(scams.stats).toEqual(original.stats)
   expect(scams.energy).toBe(original.energy)
  }
  expect([1, 2, 3, 4].map(xpToNextLevel)).toEqual([100, 200, 300, 400])
 })
 it("is one-time across replays/reloads, touches no ledger and never downgrades advanced pilots", () => {
  const data = new Map<string, string>();const store={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
  data.set("xoe.rewardLedger.v1", "untouched")
  const first=settleRouteCheckpoints(store,["wallet","keys","blocks"])
  expect(first.level).toBe(3)
  expect(settleRouteCheckpoints(store,["wallet","keys","blocks"])).toEqual(first)
  expect(settleRouteCheckpoints(store,["blocks","scams"]).level).toBe(5)
  expect(data.get("xoe.rewardLedger.v1")).toBe("untouched")
  const advanced={...initialMeta(),level:7,xp:93}
  expect(routeCheckpoint(advanced,"blocks")).toBe(advanced)
  expect(routeCheckpoint(advanced,"wallet")).toBe(advanced)
 })
})
