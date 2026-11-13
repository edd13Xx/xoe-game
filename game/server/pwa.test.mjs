import test from 'node:test'
import assert from 'node:assert/strict'
import { makeManifest, ICON_FILES } from '../pwa/manifest.mjs'
test('PWA keeps title, icons and standalone shell while supporting both phone orientations', () => {
 const manifest=makeManifest(ICON_FILES)
 assert.equal(manifest.name,'XOE: Unknown Orbital Engine')
 assert.equal(manifest.display,'standalone')
 assert.equal(manifest.orientation,'any')
 assert.ok(manifest.icons.some(i=>i.sizes==='192x192'))
 assert.ok(manifest.icons.some(i=>i.sizes==='512x512'))
})
