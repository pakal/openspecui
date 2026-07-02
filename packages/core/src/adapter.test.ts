import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { OpenSpecAdapter } from './adapter.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

describe('OpenSpecAdapter change files', () => {
  let tempDir: string
  let adapter: OpenSpecAdapter

  beforeEach(async () => {
    tempDir = await createTempDir()
    adapter = new OpenSpecAdapter(tempDir)
    await mkdir(join(tempDir, 'openspec', 'changes', 'demo'), { recursive: true })
    await writeFile(join(tempDir, 'openspec', 'changes', 'demo', 'proposal.md'), '# Demo', 'utf-8')
    await writeFile(
      join(tempDir, 'openspec', 'changes', 'demo', '.openspec.yaml'),
      'schema: spec-driven\n',
      'utf-8'
    )
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('includes hidden metadata file in change folder listing', async () => {
    const files = await adapter.readChangeFiles('demo')
    const metadata = files.find((file) => file.path === '.openspec.yaml' && file.type === 'file')

    expect(metadata).toBeDefined()
    expect(metadata?.content).toContain('schema:')
    expect(metadata?.mime).toBe('application/yaml')
    expect(metadata?.previewKind).toBe('text')
  })

  it('does not force binary files into utf-8 content', async () => {
    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
    await writeFile(join(tempDir, 'openspec', 'changes', 'demo', 'preview.png'), binary)

    const files = await adapter.readChangeFiles('demo')
    const image = files.find((file) => file.path === 'preview.png' && file.type === 'file')

    expect(image).toBeDefined()
    expect(image?.content).toBeUndefined()
    expect(image?.mime).toBe('image/png')
    expect(image?.previewKind).toBe('image')
  })

  it('initializes project.md without creating openspec/AGENTS.md', async () => {
    await adapter.init()

    await expect(stat(join(tempDir, 'openspec', 'project.md'))).resolves.toBeDefined()
    await expect(stat(join(tempDir, 'openspec', 'AGENTS.md'))).rejects.toThrow()
  })

  it('computes schema-driven change progress without requiring proposal.md', async () => {
    const changeDir = join(tempDir, 'openspec', 'changes', 'vision-demo')
    await mkdir(join(tempDir, 'openspec', 'schemas', 'vision-driven'), { recursive: true })
    await mkdir(join(changeDir, 'plans'), { recursive: true })
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: vision-driven\n', 'utf-8')
    await writeFile(
      join(tempDir, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
      `name: vision-driven
artifacts:
  - id: plan
    generates: plans/*.md
  - id: tasks
    generates: tasks.md
apply:
  tracks: tasks.md
`,
      'utf-8'
    )
    await writeFile(join(changeDir, 'tasks.md'), '- [x] Done\n- [ ] Todo\n', 'utf-8')
    await writeFile(join(changeDir, 'plans', 'plan.md'), '- [x] Planned\n', 'utf-8')
    await writeFile(join(changeDir, 'notes.md'), '- [x] Untracked\n', 'utf-8')
    clearCache()

    const changes = await adapter.listChangesWithMeta()
    const meta = changes.find((change) => change.id === 'vision-demo')

    expect(meta?.name).toBe('vision-demo')
    expect(meta?.progress).toEqual({ total: 3, completed: 2 })
  })

  it('computes archived schema task progress from matched markdown files', async () => {
    const archiveDir = join(tempDir, 'openspec', 'changes', 'archive', '2026-06-01-vision-demo')
    await mkdir(join(tempDir, 'openspec', 'schemas', 'vision-driven'), { recursive: true })
    await mkdir(join(archiveDir, 'plan'), { recursive: true })
    await writeFile(join(archiveDir, '.openspec.yaml'), 'schema: vision-driven\n', 'utf-8')
    await writeFile(
      join(tempDir, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
      `name: vision-driven
artifacts:
  - id: plan
    generates: plan/*.md
`,
      'utf-8'
    )
    await writeFile(join(archiveDir, 'plan', 'todo.md'), '- [x] Archived task\n', 'utf-8')
    clearCache()

    const archives = await adapter.listArchivedChangesWithMeta()
    const meta = archives.find((archive) => archive.id === '2026-06-01-vision-demo')

    expect(meta?.progress).toEqual({ total: 1, completed: 1 })
  })
})

/**
 * Nested-specs layout: some OpenSpec projects store multiple specs per topic as
 * `openspec/specs/<topic>/<feature>.md` instead of the canonical
 * `openspec/specs/<capability>/spec.md`. The adapter must support both.
 */
describe('OpenSpecAdapter spec layouts', () => {
  let tempDir: string
  let specsDir: string
  let adapter: OpenSpecAdapter

  beforeEach(async () => {
    tempDir = await createTempDir()
    specsDir = join(tempDir, 'openspec', 'specs')
    // Canonical layout: specs/auth/spec.md
    await mkdir(join(specsDir, 'auth'), { recursive: true })
    await writeFile(join(specsDir, 'auth', 'spec.md'), '# Auth Spec\n\nCanonical.\n', 'utf-8')
    // Nested layout: specs/account/<feature>.md
    await mkdir(join(specsDir, 'account'), { recursive: true })
    await writeFile(join(specsDir, 'account', '2fa.md'), '# Two-Factor Auth\n\nNested.\n', 'utf-8')
    await writeFile(join(specsDir, 'account', 'password.md'), '# Password\n\nNested.\n', 'utf-8')
    adapter = new OpenSpecAdapter(tempDir)
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('lists canonical and nested spec ids', async () => {
    const ids = await adapter.listSpecs()
    expect(ids.sort()).toEqual(['account/2fa', 'account/password', 'auth'])
  })

  it('resolves the canonical spec.md file', async () => {
    const resolved = await adapter.resolveSpecFile('auth')
    expect(resolved?.relativePath).toBe('openspec/specs/auth/spec.md')
    expect(resolved?.absolutePath).toBe(join(specsDir, 'auth', 'spec.md'))
  })

  it('resolves a nested feature file', async () => {
    const resolved = await adapter.resolveSpecFile('account/2fa')
    expect(resolved?.relativePath).toBe('openspec/specs/account/2fa.md')
    expect(resolved?.absolutePath).toBe(join(specsDir, 'account', '2fa.md'))
  })

  it('returns null when a spec id resolves to neither layout', async () => {
    expect(await adapter.resolveSpecFile('does/not-exist')).toBeNull()
  })

  it('reads raw content for both layouts', async () => {
    expect(await adapter.readSpecRaw('auth')).toContain('Canonical.')
    expect(await adapter.readSpecRaw('account/2fa')).toContain('Nested.')
  })

  it('parses nested spec names from the markdown title', async () => {
    const spec = await adapter.readSpec('account/2fa')
    expect(spec?.name).toBe('Two-Factor Auth')
  })

  it('lists metadata for every canonical and nested spec', async () => {
    const meta = await adapter.listSpecsWithMeta()
    const byId = Object.fromEntries(meta.map((entry) => [entry.id, entry.name]))
    expect(byId).toEqual({
      auth: 'Auth Spec',
      'account/2fa': 'Two-Factor Auth',
      'account/password': 'Password',
    })
  })

  it('writes a nested spec back to its <feature>.md file, not a spec.md directory', async () => {
    await adapter.writeSpec('account/2fa', '# Two-Factor Auth\n\nUpdated.\n')
    const updated = await readFile(join(specsDir, 'account', '2fa.md'), 'utf-8')
    expect(updated).toContain('Updated.')
    // Must NOT have created specs/account/2fa/spec.md
    await expect(stat(join(specsDir, 'account', '2fa', 'spec.md'))).rejects.toThrow()
  })

  it('writes a new slash-less spec in the canonical <id>/spec.md layout', async () => {
    await adapter.writeSpec('billing', '# Billing\n')
    const written = await readFile(join(specsDir, 'billing', 'spec.md'), 'utf-8')
    expect(written).toContain('# Billing')
  })

  it('writes a new nested spec in the <topic>/<feature>.md layout', async () => {
    await adapter.writeSpec('account/recovery', '# Recovery\n')
    const written = await readFile(join(specsDir, 'account', 'recovery.md'), 'utf-8')
    expect(written).toContain('# Recovery')
  })
})
