import type {
  ManagedLocalTranslationEngineId,
  TranslationEngineGlobalSettings,
} from '@openspecui/core'

export interface TranslationWorkerResourceLimits {
  maxOldGenerationSizeMb?: number
  maxYoungGenerationSizeMb?: number
  codeRangeSizeMb?: number
}

export interface TranslationEngineWorkerPolicy {
  enabled: boolean
  resourceLimits?: TranslationWorkerResourceLimits
}

export interface TranslationEngineRuntimeStrategy {
  engineId: ManagedLocalTranslationEngineId
  memoryBudgetPercent: number
  profile: 'power-saver' | 'balanced' | 'performance'
  runtimeConfig: Record<string, unknown>
  worker: TranslationEngineWorkerPolicy
}

const DEFAULT_MEMORY_BUDGET_PERCENT = 25
const DEFAULT_TOTAL_MEMORY_MB = 8192
const MIN_WORKER_OLD_SPACE_MB = 256
const MIN_WORKER_YOUNG_SPACE_MB = 64
const DEFAULT_CODE_RANGE_MB = 128

export function resolveManagedLocalRuntimeStrategy(input: {
  engineId: ManagedLocalTranslationEngineId
  globalSettings: TranslationEngineGlobalSettings
  totalMemoryMb?: number
}): TranslationEngineRuntimeStrategy {
  const memoryBudgetPercent = readMemoryBudgetPercent(input.engineId, input.globalSettings)
  const profile = resolveMemoryProfile(memoryBudgetPercent)
  const totalMemoryMb = normalizeTotalMemoryMb(input.totalMemoryMb)
  const workerBudgetMb = Math.max(256, Math.round((totalMemoryMb * memoryBudgetPercent) / 100))
  const worker = createWorkerPolicy(workerBudgetMb)

  return {
    engineId: input.engineId,
    memoryBudgetPercent,
    profile,
    runtimeConfig: buildRuntimeConfig(input.engineId, profile),
    worker,
  }
}

function readMemoryBudgetPercent(
  engineId: ManagedLocalTranslationEngineId,
  globalSettings: TranslationEngineGlobalSettings
): number {
  const value =
    engineId === 'local-ct2'
      ? globalSettings.localCt2.memoryBudgetPercent
      : engineId === 'local-llama'
        ? globalSettings.localLlama.memoryBudgetPercent
        : globalSettings.local.memoryBudgetPercent
  return normalizeMemoryBudgetPercent(value)
}

function normalizeMemoryBudgetPercent(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MEMORY_BUDGET_PERCENT
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeTotalMemoryMb(totalMemoryMb: number | undefined): number {
  if (typeof totalMemoryMb !== 'number' || !Number.isFinite(totalMemoryMb) || totalMemoryMb <= 0) {
    return DEFAULT_TOTAL_MEMORY_MB
  }
  return Math.max(1024, Math.round(totalMemoryMb))
}

function resolveMemoryProfile(
  memoryBudgetPercent: number
): TranslationEngineRuntimeStrategy['profile'] {
  if (memoryBudgetPercent >= 70) return 'performance'
  if (memoryBudgetPercent >= 30) return 'balanced'
  return 'power-saver'
}

function createWorkerPolicy(workerBudgetMb: number): TranslationEngineWorkerPolicy {
  const oldSpace = Math.max(MIN_WORKER_OLD_SPACE_MB, Math.round(workerBudgetMb * 0.75))
  const youngSpace = Math.max(
    MIN_WORKER_YOUNG_SPACE_MB,
    Math.min(256, Math.round(workerBudgetMb * 0.2))
  )
  return {
    enabled: true,
    resourceLimits: {
      maxOldGenerationSizeMb: oldSpace,
      maxYoungGenerationSizeMb: youngSpace,
      codeRangeSizeMb: DEFAULT_CODE_RANGE_MB,
    },
  }
}

function buildRuntimeConfig(
  engineId: ManagedLocalTranslationEngineId,
  profile: TranslationEngineRuntimeStrategy['profile']
): Record<string, unknown> {
  if (engineId === 'local') {
    return profile === 'performance'
      ? {
          device: 'gpu',
          session_options: {
            enableCpuMemArena: true,
            enableMemPattern: true,
          },
        }
      : profile === 'balanced'
        ? {
            device: 'gpu',
            session_options: {
              enableCpuMemArena: true,
              enableMemPattern: false,
            },
          }
        : {
            device: 'cpu',
            session_options: {
              enableCpuMemArena: false,
              enableMemPattern: false,
            },
          }
  }

  if (engineId === 'local-ct2') {
    return profile === 'performance'
      ? { device: 'auto', threads: 6, beamSize: 4, maxBatchSize: 16 }
      : profile === 'balanced'
        ? { device: 'auto', threads: 4, beamSize: 3, maxBatchSize: 8 }
        : { device: 'cpu', threads: 2, beamSize: 2, maxBatchSize: 4 }
  }

  return profile === 'performance'
    ? {
        gpuLayers: 'max',
        contextSize: 4096,
        batchSize: 512,
        flashAttention: true,
        useMmap: false,
        useMlock: false,
      }
    : profile === 'balanced'
      ? {
          gpuLayers: 'auto',
          contextSize: 2048,
          batchSize: 256,
          flashAttention: true,
          useMmap: true,
          useMlock: false,
        }
      : {
          gpuLayers: 8,
          contextSize: 1024,
          batchSize: 128,
          flashAttention: false,
          useMmap: true,
          useMlock: false,
        }
}
