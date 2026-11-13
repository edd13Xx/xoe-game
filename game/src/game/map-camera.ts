import { WORLD_W, WORLD_H } from "./overworld.ts"
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, Math.max(0, max)))
/** Actual CSS viewport, not an assumed phone width; preserves the phone's dock clearance. */
export function mapCamera(pos: {x:number;y:number}, viewport: {w:number;h:number}, dockReserve = 0) {
 const w=Math.min(WORLD_W,Math.max(1,viewport.w)), h=Math.min(WORLD_H,Math.max(1,viewport.h))
 const offsetY=dockReserve ? Math.round(Math.max(110,Math.min(220,(h-dockReserve)/2+24))) : h/2
 return {x:clamp(pos.x-w/2,WORLD_W-w),y:clamp(pos.y-offsetY,WORLD_H-(dockReserve?Math.max(160,h-dockReserve):h)),w,h}
}
