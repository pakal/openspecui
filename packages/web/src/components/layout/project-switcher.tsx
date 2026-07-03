import { Select, type SelectOption } from '@/components/select'
import { Tooltip } from '@/components/tooltip'
import { navigateToServerHandoff } from '@/lib/server-handoff'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useProjectsOverview } from '@/lib/use-projects-overview'
import { cn } from '@/lib/utils'
import type { ProjectRoot } from '@openspecui/core'
import { Eye, EyeOff, FolderGit2, LoaderCircle } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

interface ProjectSwitcherProps {
  /** Rendered when there is nothing to switch (static/single-project/loading). */
  fallback?: ReactNode
  /** Wrapper class for the switcher row. */
  className?: string
  /** Extra class merged onto the Select trigger. */
  triggerClassName?: string
}

/**
 * Top-bar project selector for parent mode (launch dir has no `openspec/`, so its
 * children are the candidate projects). Lists `openspec/`-bearing children; folders
 * without `openspec/` are hidden behind a reveal toggle and shown disabled. Selecting
 * a project hands off to that project's server (full reload via `navigateToServerHandoff`).
 *
 * In single-project or static mode it renders `fallback` — the switcher only appears
 * when the server reports `parentMode`.
 */
export function ProjectSwitcher({
  fallback = null,
  className,
  triggerClassName,
}: ProjectSwitcherProps): ReactNode {
  const staticMode = isStaticMode()
  const [revealEmpties, setRevealEmpties] = useState(false)
  const [switchingPath, setSwitchingPath] = useState<string | null>(null)

  const overviewQuery = useProjectsOverview()
  const overview = overviewQuery.data
  const projects = useMemo<ProjectRoot[]>(() => overview?.projects ?? [], [overview])
  const switchable = useMemo(() => projects.filter((project) => project.hasOpenspec), [projects])
  const empties = useMemo(() => projects.filter((project) => !project.hasOpenspec), [projects])

  const options = useMemo<SelectOption<string>[]>(() => {
    const switchableOptions = switchable.map((project) => ({
      value: project.path,
      label: project.name,
    }))
    if (!revealEmpties) return switchableOptions
    const emptyOptions = empties.map((project) => ({
      value: project.path,
      label: project.name,
      disabled: true,
    }))
    return [...switchableOptions, ...emptyOptions]
  }, [switchable, empties, revealEmpties])

  // Only parent mode surfaces the switcher; everything else falls back to the title.
  if (staticMode || !overview?.parentMode) {
    return fallback
  }

  const handleValueChange = (path: string): void => {
    if (path === overview.currentProjectPath || switchingPath !== null) return
    setSwitchingPath(path)
    trpcClient.projects.switchProject
      .mutate({ path })
      .then((handoff) => {
        navigateToServerHandoff({ handoff, location: window.location })
      })
      .catch((error: unknown) => {
        console.error('[ProjectSwitcher] Failed to switch project:', error)
        window.alert(error instanceof Error ? error.message : 'Failed to switch project.')
        setSwitchingPath(null)
      })
  }

  const revealLabel = revealEmpties
    ? 'Hide folders without openspec/'
    : `Show ${empties.length} folder${empties.length === 1 ? '' : 's'} without openspec/`

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <Select
        value={overview.currentProjectPath}
        options={options}
        onValueChange={handleValueChange}
        ariaLabel="Switch project"
        data-testid="project-switcher"
        disabled={switchingPath !== null}
        className={cn('h-8 min-w-0 max-w-[12rem] text-xs', triggerClassName)}
        renderTrigger={({ selectedOption }) => (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {switchingPath !== null ? (
              <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">
              {selectedOption?.label ?? overview.currentProjectName}
            </span>
          </span>
        )}
      />
      {empties.length > 0 ? (
        <Tooltip content={revealLabel} sideOffset={8}>
          <button
            type="button"
            onClick={() => setRevealEmpties((current) => !current)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            aria-label={revealLabel}
            aria-pressed={revealEmpties}
          >
            {revealEmpties ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}
