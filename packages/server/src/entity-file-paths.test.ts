import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveEntityEntryPath } from './entity-file-paths.js'

const PROJECT_DIR = resolve('/tmp/openspecui-entity-test/project')

describe('resolveEntityEntryPath', () => {
  it('resolves a nested entity path inside the change root', () => {
    const result = resolveEntityEntryPath({
      projectDir: PROJECT_DIR,
      stage: 'change',
      changeId: 'add-feature',
      path: 'specs/auth/spec.md',
    })

    expect(result.relativePath).toBe('specs/auth/spec.md')
    expect(result.absolutePath).toBe(
      resolve(PROJECT_DIR, 'openspec/changes/add-feature/specs/auth/spec.md')
    )
    expect(result.absolutePath.startsWith(result.entityRoot)).toBe(true)
  })

  it('resolves the entity root entry file itself', () => {
    const result = resolveEntityEntryPath({
      projectDir: PROJECT_DIR,
      stage: 'change',
      changeId: 'add-feature',
      path: 'proposal.md',
    })

    expect(result.absolutePath).toBe(
      resolve(PROJECT_DIR, 'openspec/changes/add-feature/proposal.md')
    )
  })

  it('throws when the resolved path escapes the entity root', () => {
    expect(() =>
      resolveEntityEntryPath({
        projectDir: PROJECT_DIR,
        stage: 'change',
        changeId: 'add-feature',
        path: '../../../etc/passwd',
      })
    ).toThrow('Resolved path escaped entity root.')
  })
})
