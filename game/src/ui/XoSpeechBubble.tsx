import { useEffect, useState } from "react"
import { setXoBubbleListener } from "../game/xo-speech.ts"

/** Global XO speech bubble — shown whenever xoSpeak runs (even if voice muted). */
export function XoSpeechBubble() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    setXoBubbleListener(setText)
    return () => setXoBubbleListener(null)
  }, [])
  if (!text) return null
  return (
    <div className="xo-speech-bubble" role="status" aria-live="polite">
      <p className="speaker">XO</p>
      <p className="bubble">{text}</p>
    </div>
  )
}
