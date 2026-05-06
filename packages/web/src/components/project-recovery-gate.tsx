import { navigateToServerHandoff } from '@/lib/server-handoff'
import { useServerStatus } from '@/lib/use-server-status'
import { AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

function buildRecoveryToken(projectDir: string, detectedAt: number): string {
  return `${projectDir}:${detectedAt}`
}

function buildRecoveryStorageKey(token: string): string {
  return `openspecui-project-recovery:${encodeURIComponent(token)}`
}

function describeRecoveryState(status: ReturnType<typeof useServerStatus>['projectRecovery']): {
  title: string
  detail: string
  busy: boolean
} {
  switch (status.state) {
    case 'evicted':
      return {
        title: 'Current Worktree Evicted',
        detail:
          'The current project directory disappeared. Resolving an automatic fallback worktree now.',
        busy: true,
      }
    case 'resolving':
      return {
        title: 'Resolving Recovery Target',
        detail:
          'OpenSpecUI is locating an existing default-branch worktree to keep this session alive.',
        busy: true,
      }
    case 'ready':
      return {
        title: 'Switching To Fallback Worktree',
        detail: 'A surviving default-branch worktree was found. Redirecting this session now.',
        busy: true,
      }
    case 'unavailable':
      return {
        title: 'Automatic Recovery Unavailable',
        detail: status.message,
        busy: false,
      }
    case 'failed':
      return {
        title: 'Automatic Recovery Failed',
        detail: status.message,
        busy: false,
      }
    case 'idle':
      return {
        title: '',
        detail: '',
        busy: false,
      }
  }
}

export function ProjectRecoveryGate() {
  const status = useServerStatus()
  const attemptedTokensRef = useRef(new Set<string>())
  const recovery = status.projectRecovery

  useEffect(() => {
    if (recovery.state !== 'ready' || !status.projectDir) {
      return
    }

    const token = buildRecoveryToken(status.projectDir, recovery.detectedAt)
    const storageKey = buildRecoveryStorageKey(token)
    let alreadyAttempted = attemptedTokensRef.current.has(token)

    if (!alreadyAttempted) {
      try {
        alreadyAttempted = sessionStorage.getItem(storageKey) !== null
      } catch {
        alreadyAttempted = false
      }
    }

    if (alreadyAttempted) {
      attemptedTokensRef.current.add(token)
      return
    }

    attemptedTokensRef.current.add(token)

    try {
      sessionStorage.setItem(storageKey, recovery.handoff.serverUrl)
    } catch {
      // Ignore session storage failures and still attempt the handoff.
    }

    navigateToServerHandoff({
      handoff: recovery.handoff,
      location: window.location,
    })
  }, [recovery, status.projectDir])

  const copy = useMemo(() => describeRecoveryState(recovery), [recovery])

  if (recovery.state === 'idle') {
    return null
  }

  return (
    <div className="bg-background/80 fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm">
      <div className="border-border bg-background mx-4 max-w-xl space-y-4 rounded-lg border p-6 shadow-xl">
        <div className="flex items-center gap-2 text-lg font-semibold">
          {copy.busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
          {copy.title}
        </div>
        <p className="text-muted-foreground text-sm">{copy.detail}</p>
        {status.projectDir ? (
          <div className="bg-muted text-muted-foreground break-all rounded-md px-3 py-2 font-mono text-xs">
            Source: {status.projectDir}
          </div>
        ) : null}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <ArrowRightLeft className="h-4 w-4" />
          Recovery preserves the current route and only swaps the backend/worktree target.
        </div>
        {!copy.busy ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => {
                window.location.reload()
              }}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
            >
              Reload
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
