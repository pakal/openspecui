import { mkdtemp, realpath, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir } from '../__tests__/test-utils.js'
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'

describe('resolveRealPathThroughExistingAncestor', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-realpath-'))
  })

  afterEach(async () => {
    await cleanupTempDir(tempDir)
  })

  it('keeps the realpath prefix for missing descendants under a symlinked ancestor', async () => {
    const targetRoot = await mkdtemp(join(tempDir, 'target-'))
    const symlinkRoot = join(tempDir, 'link')
    await symlink(targetRoot, symlinkRoot, 'dir')

    const resolved = resolveRealPathThroughExistingAncestor(
      join(symlinkRoot, 'missing', 'child.txt')
    )

    await expect(realpath(targetRoot)).resolves.toBe(dirname(dirname(resolved)))
    expect(resolved.endsWith(`${basename(targetRoot)}/missing/child.txt`)).toBe(true)
  })
})
