/** Short chapter intro cards — no scoring / coin system in story text. */
export interface ChapterIntro {
  id: "ch1" | "ch2" | "ch3"
  title: string
  body: string
}

export const CHAPTER_INTROS: readonly ChapterIntro[] = [
  {
    id: "ch1",
    title: "Chapter 1",
    body: "Colony to colony. Your vault is cold storage — they can’t crack it from the wire, so they try phishing or remote hacks instead. Side missions may pop up. Learn the gates. Testnet XOE · no real money.",
  },
  {
    id: "ch2",
    title: "Chapter 2",
    body: "The truth lands soft: you are the key. Every lock you cleared was waiting for you.",
  },
  {
    id: "ch3",
    title: "Chapter 3",
    body: "The keys open a special vault — like the XOE vault, XO’s creation site. There XO gains flight to space and the moons, and takes you with her.",
  },
] as const
