/**
 * Display vs speech forms:
 * - SIS on screen → spoken "S. I. S."
 * - XO on screen → spoken "X. O." (letters; Zoe no longer fits)
 */

const SIS_WORD = /\bSIS\b/g
const XO_WORD = /\bXO\b/g
const XOE_WORD = /\bXOE\b/g

/** Keep on-screen text unchanged; expand letter names for TTS / spoken strings only. */
export function spokenForm(text: string): string {
  return text
    .replace(SIS_WORD, "S. I. S.")
    .replace(XOE_WORD, "X. O.")
    .replace(XO_WORD, "X. O.")
}

export function containsSis(text: string): boolean {
  return /\bSIS\b/.test(text)
}
