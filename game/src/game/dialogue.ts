export const DIALOGUE_MENU = [
  {
    id: "bubble",
    label: "Bubble text on screen",
    showsDialogueText: true,
    audioOnly: false,
    connectsGrok: false,
  },
  {
    id: "audio-only",
    label: "Audio only, no dialogue text",
    showsDialogueText: false,
    audioOnly: true,
    connectsGrok: false,
  },
  {
    id: "grok",
    label: "Connect to Grok Bot",
    showsDialogueText: false,
    audioOnly: false,
    connectsGrok: true,
  },
] as const

export type DialogueMode = "bubble" | "audio-only"

export const GROK_STATUS = "Grok Bot is ready. Paste your xAI key to turn on live Grok Bot. Until then XOE uses the built-in AI."

export interface SpeechSupport {
  available: boolean
  reason: string | null
}

export function evaluateSpeech(input: { synthPresent: boolean; voiceCount: number }): SpeechSupport {
  if (!input.synthPresent || input.voiceCount < 1) {
    return {
      available: false,
      reason:
        "On-device speech is unavailable in this browser. Audio-only dialogue cannot play here. No external voice service is used.",
    }
  }
  return { available: true, reason: null }
}

export function presentDialogue(
  line: string,
  mode: DialogueMode,
  speech: SpeechSupport,
): { text: string | null; speak: string | null; status: string | null } {
  if (mode === "bubble") return { text: line, speak: null, status: null }
  if (speech.available) return { text: null, speak: line, status: null }
  return { text: null, speak: null, status: speech.reason }
}

export function shouldAnimate(flags: {
  hidden: boolean
  reducedMotion: boolean
  storyPaused: boolean
}): boolean {
  return !flags.hidden && !flags.reducedMotion && !flags.storyPaused
}
