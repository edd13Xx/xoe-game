import type { MusicController } from "./music.ts"

let current: MusicController | null = null

export function bindMusicController(music: MusicController | null): void {
  current = music
}

export function musicBus(): MusicController | null {
  return current
}
