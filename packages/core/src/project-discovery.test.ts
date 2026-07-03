import { mkdir } from 'fs/promises'
import { join, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir, createTempSubDir } from './__tests__/test-utils.js'
import { discoverProjectRoots } from './project-discovery.js'

/** Create `<parent>/<name>/openspec` so the child qualifies as a project. */
async function createProjectChild(parent: string, name: string): Promise<string> {
  const childDir = await createTempSubDir(parent, name)
  await mkdir(join(childDir, 'openspec'), { recursive: true })
  return childDir
}

describe('discoverProjectRoots()', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    await cleanupTempDir(tempDir)
  })

  it('enters parent mode and flags each immediate child by openspec presence', async () => {
    await createProjectChild(tempDir, 'alpha')
    await createProjectChild(tempDir, 'beta')
    await createTempSubDir(tempDir, 'gamma') // no openspec/ → non-project

    const discovery = await discoverProjectRoots(tempDir)

    expect(discovery.isParentMode).toBe(true)
    expect(discovery.parentRoot).toBe(resolve(tempDir))
    expect(discovery.projects).toEqual([
      { name: 'alpha', path: resolve(tempDir, 'alpha'), hasOpenspec: true },
      { name: 'beta', path: resolve(tempDir, 'beta'), hasOpenspec: true },
      { name: 'gamma', path: resolve(tempDir, 'gamma'), hasOpenspec: false },
    ])
  })

  it('hides non-project children from the default and picks first openspec child by name', async () => {
    await createTempSubDir(tempDir, 'alpha') // alphabetically first but NOT a project
    await createProjectChild(tempDir, 'beta')
    await createProjectChild(tempDir, 'charlie')

    const discovery = await discoverProjectRoots(tempDir)

    // default skips the non-project 'alpha' and selects the first openspec child.
    expect(discovery.defaultProjectPath).toBe(resolve(tempDir, 'beta'))
    const projectChildren = discovery.projects.filter((project) => project.hasOpenspec)
    expect(projectChildren.map((project) => project.name)).toEqual(['beta', 'charlie'])
  })

  it('passes through single-project mode when the launch dir owns openspec/', async () => {
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    await createProjectChild(tempDir, 'nested') // must be ignored in single mode

    const discovery = await discoverProjectRoots(tempDir)

    expect(discovery.isParentMode).toBe(false)
    expect(discovery.defaultProjectPath).toBe(resolve(tempDir))
    expect(discovery.projects).toEqual([
      { name: resolve(tempDir).split(/[/\\]/).pop(), path: resolve(tempDir), hasOpenspec: true },
    ])
  })

  it('stays in parent mode with a null default when no child is a project', async () => {
    await createTempSubDir(tempDir, 'docs')
    await createTempSubDir(tempDir, 'notes')

    const discovery = await discoverProjectRoots(tempDir)

    expect(discovery.isParentMode).toBe(true)
    expect(discovery.defaultProjectPath).toBeNull()
    expect(discovery.projects.every((project) => !project.hasOpenspec)).toBe(true)
  })

  it('returns resolved absolute paths for every discovered project', async () => {
    await createProjectChild(tempDir, 'alpha')

    const discovery = await discoverProjectRoots(tempDir)

    for (const project of discovery.projects) {
      expect(project.path).toBe(resolve(project.path))
      expect(project.path.startsWith(resolve(tempDir))).toBe(true)
    }
  })
})
