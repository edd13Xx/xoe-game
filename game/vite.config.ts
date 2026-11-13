// @ts-expect-error server-only JavaScript module
import { guestMiddleware } from "./server/grok-http.mjs"
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

function grokGuestPlugin(): Plugin {
  return {
    name: "xoe-grok-guest",
    configureServer(server) { server.middlewares.use(guestMiddleware) },
    configurePreviewServer(server) { server.middlewares.use(guestMiddleware) },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/client': 'preact/compat/client',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
    },
  },
  base: './',
  plugins: [react(), viteSingleFile(), grokGuestPlugin()],
  server: { host: '127.0.0.1', port: 4317, strictPort: true },
  preview: { host: '127.0.0.1', port: 4317, strictPort: true },
  build: {
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 2000,
  },
})
