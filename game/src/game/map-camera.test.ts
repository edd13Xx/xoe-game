import { describe, it, expect } from "vitest"
import { mapCamera } from "./map-camera.ts"
import { WORLD_W } from "./overworld.ts"
describe("responsive world camera",()=>{
 it("uses the measured width and never exposes space beyond the world edges",()=>{
  for(const w of [358,802,1058,1800])for(const x of [40,600,1160]){
   const c=mapCamera({x,y:400},{w,h:480})
   expect(c.x).toBeGreaterThanOrEqual(0);expect(c.x+c.w).toBeLessThanOrEqual(WORLD_W)
   expect(x-c.x).toBeGreaterThanOrEqual(0);expect(x-c.x).toBeLessThanOrEqual(c.w)
  }
 })
 it("centres the PC pilot and preserves phone dock clearance",()=>{
  const pc=mapCamera({x:600,y:400},{w:1000,h:480});expect(pc.x).toBe(100);expect(pc.y).toBe(160)
  const phone=mapCamera({x:600,y:400},{w:358,h:560},132);expect(400-phone.y).toBe(220)
 })
})
