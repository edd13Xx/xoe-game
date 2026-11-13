import { describe, expect, it, beforeEach } from "vitest"
import {
  __resetSafeStorageForTests,
  getLocalStore,
  getSessionStore,
  storageBackendInfo,
} from "./safe-storage.ts"

describe("safe-storage", () => {
  beforeEach(() => {
    __resetSafeStorageForTests()
  })

  it("reads and writes through getLocalStore", () => {
    const store = getLocalStore()
    store.setItem("k", "v")
    expect(store.getItem("k")).toBe("v")
    store.removeItem("k")
    expect(store.getItem("k")).toBeNull()
  })

  it("session store is independent", () => {
    getLocalStore().setItem("a", "1")
    getSessionStore().setItem("a", "2")
    expect(getLocalStore().getItem("a")).toBe("1")
    expect(getSessionStore().getItem("a")).toBe("2")
  })

  it("reports a backend", () => {
    const info = storageBackendInfo()
    expect(info.local === "real" || info.local === "memory").toBe(true)
    expect(info.session === "real" || info.session === "memory").toBe(true)
  })
})
