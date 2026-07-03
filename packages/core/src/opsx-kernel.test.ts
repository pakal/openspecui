import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir, waitFor, waitForDebounce } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import { clearCache, initWatcherPool } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

describe('OpsxKernel artifact status reactivity', () => {
  const REACTIVE_WAIT_OPTIONS = { timeout: 20000 }
  const REACTIVE_TEST_TIMEOUT_MS = 25000
  let tempDir: string
  let kernel: OpsxKernel | null = null

  beforeEach(async () => {
    tempDir = await createTempDir()
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    await initWatcherPool(tempDir)
    clearCache()
  })

  afterEach(async () => {
    kernel?.dispose()
    kernel = null
    await closeAllWatchers()
    await waitForDebounce(200)
    clearCache()
    await cleanupTempDir(tempDir)
  })

  async function prepareKernel(outputPath: string): Promise<{
    changeDir: string
    kernel: OpsxKernel
  }> {
    const changeId = 'demo-change'
    const changeDir = join(tempDir, 'openspec', 'changes', changeId)
    await mkdir(changeDir, { recursive: true })
    await writeFile(join(tempDir, 'openspec', 'config.yaml'), 'name: test\n', 'utf-8')
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: test\n', 'utf-8')

    const cliScriptPath = join(tempDir, 'fake-openspec.mjs')
    await writeFile(
      cliScriptPath,
      `
import { existsSync, readdirSync } from 'node:fs'
import { join, matchesGlob, relative, sep } from 'node:path'

const outputPath = ${JSON.stringify(outputPath)}
const args = process.argv.slice(2)

function isGlobPattern(pattern) {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

function collectFiles(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) {
    return []
  }

  const entries = readdirSync(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(rootDir, fullPath))
      continue
    }
    if (entry.isFile()) {
      const relativePath = relative(rootDir, fullPath).split(sep).join('/')
      files.push(relativePath)
    }
  }

  return files
}

if (args.includes('--version')) {
  console.log('0.0.0-test')
  process.exit(0)
}

if (args[0] === 'status' && args.includes('--json')) {
  const changeIndex = args.indexOf('--change')
  const changeId = changeIndex >= 0 ? args[changeIndex + 1] : 'unknown-change'
  const changeDir = join(process.cwd(), 'openspec', 'changes', changeId)
  const done = isGlobPattern(outputPath)
    ? collectFiles(changeDir).some((path) => matchesGlob(path, outputPath))
    : existsSync(join(changeDir, outputPath))

  console.log(
    JSON.stringify({
      changeName: changeId,
      schemaName: 'test',
      isComplete: done,
      applyRequires: [],
      artifacts: [
        {
          id: 'artifact',
          outputPath,
          status: done ? 'done' : 'blocked',
          missingDeps: done ? [] : [outputPath],
        },
      ],
    })
  )
  process.exit(0)
}

console.error('Unsupported args:', args.join(' '))
process.exit(1)
      `.trimStart(),
      'utf-8'
    )

    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({
      cli: {
        command: process.execPath,
        args: [cliScriptPath],
      },
    })

    const cliExecutor = new CliExecutor(configManager, tempDir)
    kernel = new OpsxKernel(tempDir, cliExecutor)
    return { changeDir, kernel }
  }

  async function waitForReactiveStatusSetup(): Promise<void> {
    // Native watcher backends can take a brief moment to begin delivering
    // nested file events after the initial reactive status stream is created.
    await waitForDebounce(1000)
  }

  it(
    'refreshes status when a file appears inside an existing subdirectory',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/result.md')
      await mkdir(join(changeDir, 'loop'), { recursive: true })

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()
      await waitForDebounce(1000)

      await writeFile(join(changeDir, 'loop', 'result.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status when missing parent directories are created later',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/nested/result.md')

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()
      const initialStatus = kernel.getStatus('demo-change')

      await mkdir(join(changeDir, 'loop', 'nested'), { recursive: true })
      await waitFor(() => kernel.getStatus('demo-change') !== initialStatus, REACTIVE_WAIT_OPTIONS)
      await writeFile(join(changeDir, 'loop', 'nested', 'result.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status for glob artifacts when matching files appear in subdirectories',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/**/*.md')
      await mkdir(join(changeDir, 'loop'), { recursive: true })

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()

      await mkdir(join(changeDir, 'loop', 'docs'), { recursive: true })
      await waitForDebounce(250)
      await writeFile(join(changeDir, 'loop', 'docs', 'guide.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )

  it(
    'refreshes status for question-mark glob artifacts',
    async () => {
      const { changeDir, kernel } = await prepareKernel('loop/file?.md')
      await mkdir(join(changeDir, 'loop'), { recursive: true })

      await kernel.ensureStatus('demo-change')
      expect(kernel.getStatus('demo-change').artifacts[0]?.status).toBe('blocked')
      await waitForReactiveStatusSetup()

      await writeFile(join(changeDir, 'loop', 'file1.md'), 'done\n', 'utf-8')

      await waitFor(
        () => kernel.getStatus('demo-change').artifacts[0]?.status === 'done',
        REACTIVE_WAIT_OPTIONS
      )
    },
    REACTIVE_TEST_TIMEOUT_MS
  )
})

describe('OpsxKernel CLI error handling', () => {
  let tempDir: string
  let kernel: OpsxKernel | null = null

  beforeEach(async () => {
    tempDir = await createTempDir()
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    await initWatcherPool(tempDir)
    clearCache()
  })

  afterEach(async () => {
    kernel?.dispose()
    kernel = null
    await closeAllWatchers()
    await waitForDebounce(200)
    clearCache()
    await cleanupTempDir(tempDir)
  })

  async function prepareKernelWithChanges(changeIds: string[]): Promise<OpsxKernel> {
    await writeFile(join(tempDir, 'openspec', 'config.yaml'), 'name: test\n', 'utf-8')
    for (const changeId of changeIds) {
      const changeDir = join(tempDir, 'openspec', 'changes', changeId)
      await mkdir(changeDir, { recursive: true })
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: test\n', 'utf-8')
    }

    // Fake CLI: changes whose id starts with 'bad' emulate openspec's structured
    // error contract — a JSON envelope on STDOUT with a non-zero exit and empty
    // stderr; every other change returns a valid status.
    const cliScriptPath = join(tempDir, 'fake-openspec.mjs')
    await writeFile(
      cliScriptPath,
      `
const args = process.argv.slice(2)

if (args.includes('--version')) {
  console.log('0.0.0-test')
  process.exit(0)
}

if (args[0] === 'status' && args.includes('--json')) {
  const changeIndex = args.indexOf('--change')
  const changeId = changeIndex >= 0 ? args[changeIndex + 1] : 'unknown-change'

  if (changeId.startsWith('bad')) {
    console.log(
      JSON.stringify({
        status: [
          {
            severity: 'error',
            code: 'change_error',
            message: 'Change "' + changeId + '" was not found.',
          },
        ],
      })
    )
    process.exit(1)
  }

  console.log(
    JSON.stringify({
      changeName: changeId,
      schemaName: 'test',
      isComplete: true,
      applyRequires: [],
      artifacts: [],
    })
  )
  process.exit(0)
}

console.error('Unsupported args:', args.join(' '))
process.exit(1)
      `.trimStart(),
      'utf-8'
    )

    const configManager = new ConfigManager(tempDir)
    await configManager.writeConfig({
      cli: { command: process.execPath, args: [cliScriptPath] },
    })
    const cliExecutor = new CliExecutor(configManager, tempDir)
    kernel = new OpsxKernel(tempDir, cliExecutor)
    return kernel
  }

  it('surfaces the CLI structured error message instead of an opaque exit code', async () => {
    const kernel = await prepareKernelWithChanges(['bad-change'])

    await expect(kernel.ensureStatus('bad-change')).rejects.toThrow(
      'Change "bad-change" was not found.'
    )
  })

  it('excludes a failing change from the status list instead of poisoning it', async () => {
    const kernel = await prepareKernelWithChanges(['good-change', 'bad-change'])

    await kernel.ensureStatusList()

    const names = kernel.getStatusList().map((status) => status.changeName)
    expect(names).toContain('good-change')
    expect(names).not.toContain('bad-change')
  })
})
