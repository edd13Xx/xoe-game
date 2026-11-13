/**
 * v18.3 (XOE-004): tiny in-page bus so a lesson, the loss card or the menu can open the FAQ at a section,
 * and the FAQ can open Ask XOE with a prefilled question. No network, no storage.
 */
import type { FaqId } from "./faq.ts"

export const OPEN_FAQ_EVENT = "xoe:open-faq"
export const OPEN_ASK_EVENT = "xoe:open-ask"

let pendingSection: FaqId | null = null
let pendingAsk: string | null = null

export function requestOpenFaq(section: FaqId): void {
  pendingSection = section
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_FAQ_EVENT, { detail: section }))
}
export function takeFaqSection(): FaqId | null {
  const s = pendingSection
  pendingSection = null
  return s
}

export function requestAskXoe(prefill: string): void {
  pendingAsk = prefill
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_ASK_EVENT, { detail: prefill }))
}
export function takeAskPrefill(): string | null {
  const s = pendingAsk
  pendingAsk = null
  return s
}
