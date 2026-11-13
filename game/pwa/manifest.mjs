/** One source for the XOE web app manifest (used by the single file and the PWA folder). */
export const APP_THEME = "#1a1530"
export const APP_BACKGROUND = "#0b0d12"

export function makeManifest(icons) {
  return {
    name: "XOE: Unknown Orbital Engine",
    short_name: "XOE",
    description: "XOE trade practice. Learn while you fly. Testnet only, no real money.",
    id: "./",
    start_url: "./index.html",
    scope: "./",
    display: "standalone",
    orientation: "any",
    background_color: APP_BACKGROUND,
    theme_color: APP_THEME,
    icons,
  }
}

export const ICON_FILES = [
  { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
]
export const APPLE_ICON = "icons/icon-180.png"
