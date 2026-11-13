import { useEffect } from "react"
import { xoSpeak } from "../game/xo-speech.ts"

export function DialogueSpeaker({ line }: { line: string | null }) {
  useEffect(() => {
    if (!line) return
    void xoSpeak(line)
    return () => {
      if (typeof window === "undefined") return
      try {
        window.speechSynthesis?.cancel()
      } catch {
        // speech blocked in sandbox
      }
    }
  }, [line])
  return null
}
