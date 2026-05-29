import {
  normalizeBatchTranslationError,
  type BatchTranslateEvent,
  type BatchTranslationError,
  type ManagedLocalTranslationEngineId,
  type TranslatorFactory,
} from '@openspecui/core'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import type { TranslationWorkerResourceLimits } from './translation-engine-runtime-strategy.js'

export interface ManagedLocalTranslationWorkerRequest {
  engineId: ManagedLocalTranslationEngineId
  sourceLanguage: string
  targetLanguage: string
  model?: string
  dtype?: string
  runtimeConfig?: Record<string, unknown>
  inputs: string[]
  instructions?: string
  context?: string
  timeoutMs?: number
  cacheDir: string
}

export interface ManagedLocalBatchTranslateExecutionInput
  extends Omit<ManagedLocalTranslationWorkerRequest, 'cacheDir'> {
  signal: AbortSignal
  workerResourceLimits?: TranslationWorkerResourceLimits
}

export type ManagedLocalTranslationWorkerMessage =
  | { type: 'event'; event: BatchTranslateEvent }
  | { type: 'complete' }
  | { type: 'error'; error: BatchTranslationError }

const SOURCE_BOOTSTRAP_ENTRY_URL_KEY = '__openspecuiTranslationWorkerEntryUrl'
const DEVELOPMENT_EXPORT_CONDITION = '--conditions=development'

async function createWorkerFactory(
  request: ManagedLocalTranslationWorkerRequest
): Promise<TranslatorFactory> {
  if (request.engineId === 'local') {
    const mod = (await import('@openspecui/local-translator')) as {
      createLocalTranslatorFactory: (options?: {
        defaultModel?: string
        cacheDir?: string
        localOnly?: boolean
      }) => TranslatorFactory
    }
    return mod.createLocalTranslatorFactory({
      defaultModel: request.model,
      cacheDir: request.cacheDir,
      localOnly: true,
    })
  }

  if (request.engineId === 'local-ct2') {
    const mod = (await import('@openspecui/local-ct2-translator')) as {
      createLocalCt2TranslatorFactory: (options?: {
        defaultModel?: string
        cacheDir?: string
      }) => TranslatorFactory
    }
    return mod.createLocalCt2TranslatorFactory({
      defaultModel: request.model,
      cacheDir: request.cacheDir,
    })
  }

  const mod = (await import('@openspecui/local-llama-translator')) as {
    createLocalLlamaTranslatorFactory: (options?: {
      defaultModel?: string
      cacheDir?: string
    }) => TranslatorFactory
  }
  return mod.createLocalLlamaTranslatorFactory({
    defaultModel: request.model,
    cacheDir: request.cacheDir,
  })
}

async function runManagedLocalTranslationWorker(
  request: ManagedLocalTranslationWorkerRequest
): Promise<void> {
  if (!parentPort) {
    throw new Error('Missing parentPort for managed local translation worker.')
  }

  const controller = new AbortController()
  parentPort.on('message', (message: unknown) => {
    if (message === 'abort') {
      controller.abort(new DOMException('Translation cancelled.', 'AbortError'))
    }
  })

  try {
    const factory = await createWorkerFactory(request)
    const translator = await factory.create({
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      model: request.model,
      dtype: request.dtype,
      runtimeConfig: request.runtimeConfig,
      signal: controller.signal,
    })

    try {
      for await (const event of translator.batchTranslate(request.inputs, {
        instructions: request.instructions,
        context: request.context,
        signal: controller.signal,
        timeoutMs: request.timeoutMs,
      })) {
        parentPort.postMessage({
          type: 'event',
          event,
        } satisfies ManagedLocalTranslationWorkerMessage)
      }
      parentPort.postMessage({ type: 'complete' } satisfies ManagedLocalTranslationWorkerMessage)
    } finally {
      translator.destroy?.()
    }
  } catch (error) {
    const normalized = normalizeBatchTranslationError(error, controller.signal)
    parentPort.postMessage({
      type: 'error',
      error: normalized,
    } satisfies ManagedLocalTranslationWorkerMessage)
  }
}

export function createManagedLocalBatchTranslateWorkerExecutor(options: {
  resolveCacheDir: (engineId: ManagedLocalTranslationEngineId) => string
  resolveResourceLimits?: (
    input: ManagedLocalBatchTranslateExecutionInput
  ) => TranslationWorkerResourceLimits | undefined
}) {
  return async function* executeManagedLocalBatchTranslateInWorker(
    input: ManagedLocalBatchTranslateExecutionInput
  ): AsyncGenerator<BatchTranslateEvent> {
    const worker = createManagedLocalTranslationWorker({
      request: {
        engineId: input.engineId,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        model: input.model,
        dtype: input.dtype,
        runtimeConfig: input.runtimeConfig,
        inputs: input.inputs,
        instructions: input.instructions,
        context: input.context,
        timeoutMs: input.timeoutMs,
        cacheDir: options.resolveCacheDir(input.engineId),
      },
      resourceLimits: options.resolveResourceLimits?.(input) ?? input.workerResourceLimits,
      execArgv: process.execArgv,
    })
    const queue: BatchTranslateEvent[] = []
    let completed = false
    let thrown: Error | null = null
    const abort = () => {
      try {
        worker.postMessage('abort')
      } catch {
        // ignore shutdown races
      }
    }
    input.signal.addEventListener('abort', abort, { once: true })
    worker.on('message', (message: ManagedLocalTranslationWorkerMessage) => {
      if (message.type === 'event') {
        queue.push(message.event)
        return
      }
      if (message.type === 'complete') {
        completed = true
        return
      }
      thrown = new Error(message.error.message)
      completed = true
    })
    worker.on('error', (error) => {
      thrown = error
      completed = true
    })

    try {
      while (!completed || queue.length > 0) {
        if (input.signal.aborted) {
          throw new DOMException('Translation cancelled.', 'AbortError')
        }
        const next = queue.shift()
        if (next) {
          yield next
          continue
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (thrown) throw thrown
    } finally {
      input.signal.removeEventListener('abort', abort)
      await worker.terminate()
    }
  }
}

function createManagedLocalTranslationWorker(input: {
  request: ManagedLocalTranslationWorkerRequest
  resourceLimits?: {
    maxOldGenerationSizeMb?: number
    maxYoungGenerationSizeMb?: number
    codeRangeSizeMb?: number
  }
  execArgv?: string[]
}): Worker {
  if (isSourceEntryUrl(import.meta.url)) {
    return new Worker(buildSourceBootstrapWorkerSource(), {
      eval: true,
      execArgv: withDevelopmentExecArgv(input.execArgv ?? []),
      workerData: {
        ...input.request,
        [SOURCE_BOOTSTRAP_ENTRY_URL_KEY]: import.meta.url,
      },
      ...(input.resourceLimits ? { resourceLimits: input.resourceLimits } : {}),
    })
  }

  return new Worker(new URL(import.meta.url), {
    execArgv: input.execArgv,
    workerData: input.request,
    ...(input.resourceLimits ? { resourceLimits: input.resourceLimits } : {}),
  })
}

function isSourceEntryUrl(entryUrl: string): boolean {
  return new URL(entryUrl).pathname.endsWith('.ts')
}

function withDevelopmentExecArgv(execArgv: string[]): string[] {
  return execArgv.includes(DEVELOPMENT_EXPORT_CONDITION)
    ? [...execArgv]
    : [...execArgv, DEVELOPMENT_EXPORT_CONDITION]
}

function buildSourceBootstrapWorkerSource(): string {
  return `
const { parentPort, workerData } = require('node:worker_threads')
;(async () => {
  const entryUrl = workerData.${SOURCE_BOOTSTRAP_ENTRY_URL_KEY}
  if (typeof entryUrl !== 'string') {
    throw new Error('Invalid translation worker bootstrap entry URL.')
  }
  const { tsImport } = await import('tsx/esm/api')
  await tsImport(entryUrl, { parentURL: entryUrl })
})().catch((error) => {
  parentPort?.postMessage(
    error instanceof Error
      ? { type: 'error', error: { kind: 'runtime', message: error.message } }
      : { type: 'error', error: { kind: 'runtime', message: String(error) } }
  )
  process.exit(1)
})
`
}

function isWorkerRequest(value: unknown): value is ManagedLocalTranslationWorkerRequest {
  if (typeof value !== 'object' || value === null) return false
  const engineId = Reflect.get(value, 'engineId')
  const sourceLanguage = Reflect.get(value, 'sourceLanguage')
  const targetLanguage = Reflect.get(value, 'targetLanguage')
  const inputs = Reflect.get(value, 'inputs')
  const cacheDir = Reflect.get(value, 'cacheDir')
  return (
    (engineId === 'local' || engineId === 'local-ct2' || engineId === 'local-llama') &&
    typeof sourceLanguage === 'string' &&
    typeof targetLanguage === 'string' &&
    Array.isArray(inputs) &&
    inputs.every((entry) => typeof entry === 'string') &&
    typeof cacheDir === 'string'
  )
}

if (!isMainThread) {
  if (!isWorkerRequest(workerData)) {
    throw new Error('Invalid managed local translation worker payload.')
  }
  void runManagedLocalTranslationWorker(workerData)
}
