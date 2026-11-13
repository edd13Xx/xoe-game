/** No keys retained here. OFF / Disconnect / key change cancels pending xAI requests. */
let epoch = 0
export const grokRequestEpoch = () => epoch
const active = new Set<AbortController>()
export function trackGrokRequest(controller: AbortController): () => void {
  active.add(controller)
  return () => active.delete(controller)
}
export function cancelGrokRequests(): void {
  epoch++
  for (const controller of active) controller.abort()
  active.clear()
}
