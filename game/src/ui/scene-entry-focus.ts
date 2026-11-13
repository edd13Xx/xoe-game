/** Fresh scenes must not inherit the bottom-of-page scroll from a long moon/settings flow. */
export function focusSceneEntry(phase: string, previous: string): void {
 if (phase === "practice-pause" || phase === "practice" && previous === "practice-pause") return
 const heading = document.querySelector<HTMLElement>("#scene h1")
 if (!heading) return
 heading.setAttribute("tabindex", "-1")
 heading.focus({ preventScroll: true })
 if (phase === "colony-map") window.scrollTo({ top: 0, behavior: "instant" })
 else heading.scrollIntoView({ block: "start", behavior: "instant" })
}
