import { describe, expect, it } from 'vitest'
import { isPathInsideOrEqual } from './path-inside.js'

describe('isPathInsideOrEqual', () => {
  it('treats an exact match as inside (either separator)', () => {
    expect(isPathInsideOrEqual('/a/b', '/a/b')).toBe(true)
    expect(isPathInsideOrEqual('C:\\a\\b', 'C:\\a\\b')).toBe(true)
  })

  it('matches a nested child with POSIX separators', () => {
    expect(isPathInsideOrEqual('/a/b', '/a/b/c.md')).toBe(true)
    expect(isPathInsideOrEqual('/a/b', '/a/b/c/d.md')).toBe(true)
  })

  it('matches a nested child with Windows separators (the bug)', () => {
    expect(isPathInsideOrEqual('C:\\a\\b', 'C:\\a\\b\\c.md')).toBe(true)
    expect(isPathInsideOrEqual('P:\\Workspace\\proj', 'P:\\Workspace\\proj\\openspec\\config.yaml')).toBe(true)
  })

  it('rejects a sibling that shares a string prefix', () => {
    expect(isPathInsideOrEqual('/a/b', '/a/bc')).toBe(false)
    expect(isPathInsideOrEqual('C:\\a\\b', 'C:\\a\\bb\\c')).toBe(false)
  })

  it('rejects an unrelated path', () => {
    expect(isPathInsideOrEqual('/a/b', '/x/y')).toBe(false)
    expect(isPathInsideOrEqual('C:\\a\\b', 'D:\\a\\b\\c')).toBe(false)
  })
})
