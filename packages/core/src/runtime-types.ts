import type { GitWorktreeHandoff } from './git-panel-types.js'
import type { ProjectResidencyEvictionReason } from './reactive-fs/project-watcher.js'

export type ProjectRecoveryStatus =
  | { state: 'idle' }
  | {
      state: 'evicted'
      reason: ProjectResidencyEvictionReason
      detectedAt: number
    }
  | {
      state: 'resolving'
      reason: ProjectResidencyEvictionReason
      detectedAt: number
    }
  | {
      state: 'ready'
      reason: ProjectResidencyEvictionReason
      detectedAt: number
      handoff: GitWorktreeHandoff
    }
  | {
      state: 'unavailable'
      reason: ProjectResidencyEvictionReason
      detectedAt: number
      message: string
    }
  | {
      state: 'failed'
      reason: ProjectResidencyEvictionReason
      detectedAt: number
      message: string
    }
