import { useEffect, useRef, useState } from 'react'
import { requestOpenFaq } from '../game/faq-nav.ts'

/** Boss learning remains flight, not a question form. Existing answer reducer owns all boss math. */
export function BossFlightGates({ labels, step, paused, onGate }: { labels: string[]; step: number; paused: boolean; onGate: (index: number) => void }) {
  const [pos, setPos] = useState({ x: 36, y: 110 })
  const [target, setTarget] = useState<{x:number;y:number}|null>(null)
  const field = useRef<HTMLDivElement>(null)
  const pointer = useRef<number|null>(null)
  const crossed = useRef(false)
  useEffect(() => { setPos({x:36,y:110}); setTarget(null); crossed.current=false }, [step])
  useEffect(() => {
    if (paused || !target) return
    let raf = 0, last = performance.now()
    const frame = (now:number) => {
      const dt = Math.min(.05, (now-last)/1000); last=now
      setPos(p => { const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),move=Math.min(d,180*dt); return d<1?p:{x:p.x+dx/d*move,y:p.y+dy/d*move} })
      raf=requestAnimationFrame(frame)
    }
    raf=requestAnimationFrame(frame)
    return ()=>cancelAnimationFrame(raf)
  }, [target,paused])
  useEffect(() => {
    if(paused || crossed.current || pos.x<235) return
    const index=labels.findIndex((_label,i)=>Math.abs(pos.y-(40+i*70))<25)
    if(index<0)return
    crossed.current=true;setTarget(null);onGate(index)
    // A wrong gate keeps the same step. Reset flight only; the reducer retains feedback and meters.
    setPos({x:36,y:110});crossed.current=false
  }, [pos,labels,paused,onGate])
  const fly=(x:number,y:number)=>{if(!paused)setTarget({x:Math.max(16,Math.min(285,x)),y:Math.max(16,Math.min(204,y))})}
  return <>
    <p className="bubble">Protect your keys. Fly through the safe route.</p>
    <button type="button" className="link-btn" onClick={()=>requestOpenFaq('basics')}>Learn more</button>
    <div ref={field} className="arcade-field boss-flight-field" aria-label="Boss flight gates"
      onPointerDown={e=>{if(paused||pointer.current!==null)return;pointer.current=e.pointerId;const r=e.currentTarget.getBoundingClientRect();fly((e.clientX-r.left)*320/r.width,(e.clientY-r.top)*220/r.height);e.currentTarget.setPointerCapture(e.pointerId)}}
      onPointerMove={e=>{if(pointer.current!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect();fly((e.clientX-r.left)*320/r.width,(e.clientY-r.top)*220/r.height)}}
      onPointerUp={()=>{pointer.current=null}} onPointerCancel={()=>{pointer.current=null}} onLostPointerCapture={()=>{pointer.current=null}}>
      {labels.map((label,i)=><button type="button" key={`${step}-${i}`} className="touch-btn boss-flight-gate" style={{top:40+i*70}} onPointerDown={e=>e.stopPropagation()} onClick={()=>fly(260,40+i*70)}>{label}</button>)}
      <div className="arcade-xo" style={{left:pos.x,top:pos.y}}>XO</div>
    </div>
  </>
}
