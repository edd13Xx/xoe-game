import { initialPractice, paperResultStroops, type PracticeState } from './practice.ts'
/** Consume a desk exactly once. Caller records pnl and replaces the consumed session. */
export function settlePaperSession(desk: PracticeState, balanceAfter: (pnl: number) => number) {
  const pnl = paperResultStroops(desk)
  const unclaimedStroops = balanceAfter(pnl)
  return { pnl, next: initialPractice({ unclaimedStroops, price: desk.price }) }
}
