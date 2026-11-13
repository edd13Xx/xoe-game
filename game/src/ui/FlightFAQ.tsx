import { requestAskXoe } from "../game/faq-nav.ts"
import { FLIGHT_FAQ } from "../game/lesson-copy.ts"

export function FlightFAQ() {
  return <details className="flight-faq panel">
    <summary>Flight FAQ · learn at your pace</summary>
    <p className="fine">Education only · simulated practice · no real money. Never enter a real seed or secret key.</p>
    {FLIGHT_FAQ.map((item) => <details key={item.question} data-faq-question={item.question}>
      <summary>{item.question}</summary>
      <p>{item.answer}</p>
      <button type="button" className="touch-btn faq-ask" onClick={() => requestAskXoe(item.question)}>Ask XOE</button>
    </details>)}
  </details>
}
