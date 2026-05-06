import type { ProjectRecoveryStatus } from '@openspecui/core'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectRecoveryGate } from './project-recovery-gate'

const useServerStatusMock = vi.hoisted(() => vi.fn())
const navigateToServerHandoffMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-server-status', () => ({
  useServerStatus: useServerStatusMock,
}))

vi.mock('@/lib/server-handoff', () => ({
  navigateToServerHandoff: navigateToServerHandoffMock,
}))

function createStatus(projectRecovery: ProjectRecoveryStatus) {
  return {
    connected: true,
    projectDir: '/tmp/feature-worktree',
    dirName: 'feature-worktree',
    watcherEnabled: true,
    projectRecovery,
    error: null,
    wsState: 'idle' as const,
    reconnectCountdown: null,
  }
}

describe('ProjectRecoveryGate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('redirects to the resolved handoff target when recovery becomes ready', () => {
    useServerStatusMock.mockReturnValue(
      createStatus({
        state: 'ready',
        reason: 'missing-project-dir',
        detectedAt: 123,
        handoff: {
          projectDir: '/tmp/main-worktree',
          serverUrl: 'http://127.0.0.1:3200',
        },
      })
    )

    render(<ProjectRecoveryGate />)

    expect(navigateToServerHandoffMock).toHaveBeenCalledWith({
      handoff: {
        projectDir: '/tmp/main-worktree',
        serverUrl: 'http://127.0.0.1:3200',
      },
      location: window.location,
    })
  })

  it('renders an explanatory blocker when automatic recovery is unavailable', () => {
    useServerStatusMock.mockReturnValue(
      createStatus({
        state: 'unavailable',
        reason: 'project-dir-replaced',
        detectedAt: 456,
        message: 'No existing default-branch worktree is available for automatic recovery.',
      })
    )

    render(<ProjectRecoveryGate />)

    expect(screen.getByText('Automatic Recovery Unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('No existing default-branch worktree is available for automatic recovery.')
    ).toBeInTheDocument()
  })
})
