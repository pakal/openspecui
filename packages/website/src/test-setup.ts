import '@testing-library/jest-dom/vitest'

// Node 24+ ships a global `localStorage` (Web Storage) that is non-functional
// without `--localstorage-file` and shadows jsdom's, so `clear`/`getItem` go
// missing. Install a self-contained in-memory Storage so the suite is
// host-Node-independent (correct on posix CI and on local Node 25 alike).
class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

const memoryStorage = new MemoryStorage()
for (const target of [window, globalThis]) {
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    writable: true,
    value: memoryStorage,
  })
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
