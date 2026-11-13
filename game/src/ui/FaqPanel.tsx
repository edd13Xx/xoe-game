import { FlightFAQ } from "./FlightFAQ.tsx"
import { useEffect, useState } from "react"
import { FAQ_FOOTER, FAQ_SECTIONS, FAQ_TITLE, faqQuestions, type FaqId } from "../game/faq.ts"
import { requestAskXoe, takeFaqSection } from "../game/faq-nav.ts"
import { DrawerShell } from "./DrawerShell.tsx"

/** Deep links reveal the relevant answers, not merely a collapsed heading. */
function revealTopic(id: FaqId): void {
  const article = document.querySelector(`[data-faq="${id}"]`)
  article?.querySelectorAll<HTMLDetailsElement>("details[data-faq-question]").forEach(question => { question.open = true })
  article?.scrollIntoView({ block: "start" })
}

/** v18.3 (XOE-004): in-game FAQ. Plain words; every section has "Ask XOE" (Grok Bot live, or built-in). */
export function FaqPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [focus, setFocus] = useState<FaqId | null>(null)
  useEffect(() => {
    if (!open) return
    const s = takeFaqSection()
    setFocus(s)
    if (!s) return
    const t = window.setTimeout(() => {
      revealTopic(s)
    }, 30)
    return () => window.clearTimeout(t)
  }, [open])
  return (
    <DrawerShell open={open} title={FAQ_TITLE} onClose={onClose} labelledBy="drawer-faq-title">
      <section className="faq-panel" data-faq-panel="1">
        <nav className="faq-toc" aria-label="FAQ topics">
          {FAQ_SECTIONS.map((s) => (
            <a key={s.id} className="tap-link" href={`#faq-${s.id}`} onClick={(e) => {
              e.preventDefault()
              revealTopic(s.id)
            }}>
              {s.title}
            </a>
          ))}
        </nav>
        {FAQ_SECTIONS.map((s) => (
          <article key={s.id} id={`faq-${s.id}`} data-faq={s.id} className={`faq-section${focus === s.id ? " faq-focus" : ""}`}>
            <h3>{s.title}</h3>
            {faqQuestions(s).map((q) => <details key={q.id} data-faq-question={q.id}>
              <summary>{q.question}</summary>
              {q.lines.map((line, i) => <p key={i} className="faq-line">{line}</p>)}
              <button type="button" className="touch-btn faq-ask" data-faq-ask={q.id} onClick={() => requestAskXoe(q.question)}>
                Ask XOE
              </button>
            </details>)}
          </article>
        ))}
        <FlightFAQ />
        <p className="fine">{FAQ_FOOTER}</p>
      </section>
    </DrawerShell>
  )
}
