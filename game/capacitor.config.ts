import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor shell for XOE: Unknown Orbital Engine (local scaffolding only).
 * webDir is dist/, the same files as the PWA (single-file game + manifest, icons, sw.js).
 * Nothing here signs, uploads, or publishes anything. See docs/PHONE-APP.md.
 */
const config: CapacitorConfig = {
  appId: "local.xoe.unknownorbitalengine",
  appName: "XOE: Unknown Orbital Engine",
  webDir: "dist",
  backgroundColor: "#0b0d12",
  ios: {
    contentInset: "never",
    backgroundColor: "#0b0d12",
  },
  android: {
    backgroundColor: "#0b0d12",
  },
}

export default config
