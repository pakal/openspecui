import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  createManagedLocalBatchTranslateWorkerExecutor,
  type ManagedLocalTranslationChildProcess,
  type ManagedLocalTranslationWorkerMessage,
} from './translation-engine-worker.js'

class FakeTranslationChildProcess
  extends EventEmitter
  implements ManagedLocalTranslationChildProcess
{
  pid = 12345
  sentMessages: unknown[] = []
  killedSignals: Array<NodeJS.Signals | undefined> = []

  send(message: unknown): boolean {
    this.sentMessages.push(message)
    return true
  }

  kill(signal?: NodeJS.Signals): boolean {
    this.killedSignals.push(signal)
    return true
  }
}

describe('managed local translation process host', () => {
  it('turns child process crashes into per-item runtime failures', async () => {
    const child = new FakeTranslationChildProcess()
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: () => child,
    })
    const eventsPromise = collectAsyncGenerator(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello', 'World'],
        signal: new AbortController().signal,
      })
    )

    child.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
    child.emit('exit', 134, null)

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'runtime',
          message: 'Translation engine process exited unexpectedly with exit code 134.',
        },
      },
      {
        index: 1,
        error: {
          kind: 'runtime',
          message: 'Translation engine process exited unexpectedly with exit code 134.',
        },
      },
    ])
    expect(child.sentMessages[0]).toMatchObject({
      engineId: 'local-llama',
      cacheDir: '/tmp/local-llama',
    })
  })

  it('passes process heap flags and kills the child when RSS exceeds budget', async () => {
    const child = new FakeTranslationChildProcess()
    let capturedExecArgv: string[] = []
    const executor = createManagedLocalBatchTranslateWorkerExecutor({
      resolveCacheDir: () => '/tmp/local-llama',
      resolveHost: () => 'process',
      createProcessHost: (input) => {
        capturedExecArgv = input.execArgv
        return child
      },
      readProcessRssMb: vi.fn(async () => 512),
      rssPollIntervalMs: 1,
    })
    const eventsPromise = collectAsyncGenerator(
      executor({
        engineId: 'local-llama',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        model: 'model.gguf',
        inputs: ['Hello'],
        signal: new AbortController().signal,
        workerResourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 64,
          codeRangeSizeMb: 128,
          maxRssMb: 128,
        },
      })
    )

    child.emit('message', { type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)

    await expect(eventsPromise).resolves.toEqual([
      {
        index: 0,
        error: {
          kind: 'memory-limit',
          message: 'Translation process exceeded memory limit: 512MB > 128MB.',
        },
      },
    ])
    expect(capturedExecArgv).toContain('--max-old-space-size=256')
    expect(capturedExecArgv).toContain('--max-semi-space-size=64')
    expect(child.killedSignals).toContain('SIGKILL')
  })
})

async function collectAsyncGenerator<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of generator) {
    items.push(item)
  }
  return items
}
