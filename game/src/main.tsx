import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { installSafeStorageShims } from "./game/safe-storage.ts"
import App from "./App.tsx"
import "./index.css"

installSafeStorageShims()

const found = document.getElementById("root")
if (!found) throw new Error("Missing root")
const mount: HTMLElement = found

function showBootFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  mount.innerHTML = `<div role="alert" style="padding:24px;color:#f4f1ff;background:#0b0d12;font-family:system-ui,sans-serif;line-height:1.45;max-width:40rem"><p><strong>XOE could not start.</strong> ${message}</p><p>If you opened this from Files, Quick Look, or a chat attachment, open it in Safari instead, or install the hosted app from the dist folder over HTTP or HTTPS.</p></div>`
}

try {
  mount.setAttribute("data-xoe-ready", "1")
  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  showBootFailure(error)
}
