import { useEffect, useRef, type ReactNode } from "react"

/**
 * Slide-up drawer over live play. One at a time (caller enforces).
 * Close: button, Esc, backdrop tap, swipe-down. Focus moves into sheet.
 */
export function DrawerShell({
  open,
  title,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchY = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
      if (e.key !== "Tab" || !sheetRef.current) return
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )].filter(el => {
        if (el.tabIndex < 0 || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden") return false
        // Closed native details can retain layout rectangles in Chromium. Only their
        // own summary is focusable; an outer closed details also hides inner summaries.
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          if (parent.tagName !== "DETAILS" || parent.hasAttribute("open")) continue
          const summary = [...parent.children].find(child => child.tagName === "SUMMARY")
          if (!summary?.contains(el)) return false
        }
        return true
      })
      if (!focusable.length) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="drawer-overlay"
      role="presentation"
      data-drawer="open"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        touchY.current = e.touches[0]?.clientY ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchY.current
        touchY.current = null
        if (start == null) return
        const end = e.changedTouches[0]?.clientY
        if (end != null && end - start > 80) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className="drawer-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={labelledBy}
      >
        <div className="drawer-head">
          <h2 id={labelledBy}>{title}</h2>
          <button ref={closeRef} type="button" className="touch-btn ghost drawer-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  )
}
