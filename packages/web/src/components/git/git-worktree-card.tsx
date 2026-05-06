import type { DashboardGitWorktree, GitWorktreeSummary } from '@openspecui/core'
import {
  Check,
  Copy,
  FolderOpen,
  FolderOpenDot,
  GitBranch,
  LoaderCircle,
  Trash2,
} from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import {
  copyText,
  DiffStat,
  GIT_WORKTREE_BG_CLASS,
  GIT_WORKTREE_BORDER_CLASS,
  GitAheadBehindBadge,
  GitFilesBadge,
  isHttpUrl,
} from './git-shared'

export function WorktreeCard<TWorktree extends DashboardGitWorktree | GitWorktreeSummary>({
  worktree,
  emphasize,
  removing = false,
  action,
  onRemoveDetachedWorktree,
}: {
  worktree: TWorktree
  emphasize: boolean
  removing?: boolean
  action?: ReactNode
  onRemoveDetachedWorktree?: (worktree: TWorktree) => void | Promise<void>
}) {
  const isRemotePath = isHttpUrl(worktree.path)
  const canToggleRelativePath = !isRemotePath
  const canRemoveDetached = !isRemotePath && worktree.detached && !worktree.isCurrent
  const [showRelativePath, setShowRelativePath] = useState(false)
  const [copied, setCopied] = useState(false)
  const displayPath = isRemotePath
    ? worktree.path
    : showRelativePath
      ? worktree.relativePath
      : worktree.path

  const handleCopyPath = useCallback(async () => {
    try {
      await copyText(displayPath)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch (error) {
      console.error('[Git] Failed to copy worktree path:', error)
    }
  }, [displayPath])

  return (
    <article
      className={`min-w-0 rounded-md border p-3 ${
        emphasize
          ? `${GIT_WORKTREE_BORDER_CLASS} ${GIT_WORKTREE_BG_CLASS}`
          : 'border-border/70 bg-muted/15'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-1.5 text-sm font-medium">
            <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words leading-snug">{worktree.branchName}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {canRemoveDetached ? (
            <button
              type="button"
              onClick={() => {
                void onRemoveDetachedWorktree?.(worktree)
              }}
              disabled={removing}
              className="text-muted-foreground hover:text-destructive inline-flex h-7 w-7 items-center justify-center rounded border border-transparent disabled:cursor-not-allowed disabled:opacity-60"
              title="Remove detached worktree"
              aria-label="Remove detached worktree"
            >
              {removing ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
          <GitAheadBehindBadge ahead={worktree.ahead} behind={worktree.behind} />
          <GitFilesBadge files={worktree.diff.files} />
          <DiffStat diff={worktree.diff} className="justify-end" />
          {action}
        </div>
      </div>

      <div className="bg-muted/25 mt-3 flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5">
        {canToggleRelativePath ? (
          <button
            type="button"
            onClick={() => setShowRelativePath((current) => !current)}
            className="text-muted-foreground hover:text-foreground mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent"
            title={showRelativePath ? 'Show absolute path' : 'Show relative path'}
            aria-label={showRelativePath ? 'Show absolute path' : 'Show relative path'}
          >
            {showRelativePath ? (
              <FolderOpenDot className="h-3.5 w-3.5" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void handleCopyPath()
          }}
          onDoubleClick={() => {
            if (!canToggleRelativePath) return
            setShowRelativePath((current) => !current)
          }}
          className="text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-start gap-1 text-left text-xs leading-snug"
          title={displayPath}
          aria-label={`Copy ${showRelativePath && canToggleRelativePath ? 'relative' : 'absolute'} path for ${worktree.branchName}`}
        >
          <span className="min-w-0 flex-1 whitespace-normal break-all">{displayPath}</span>
          {copied ? (
            <Check className="mt-0.5 h-3 w-3 shrink-0" />
          ) : (
            <Copy className="mt-0.5 h-3 w-3 shrink-0" />
          )}
        </button>
      </div>
    </article>
  )
}
