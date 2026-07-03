import { useProjectsOverview } from '@/lib/use-projects-overview'
import { FolderX } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

/**
 * Full-screen gate for parent mode with zero OpenSpec projects.
 *
 * The launch dir has no `openspec/` of its own AND none of its immediate children
 * do either, so there is nothing to bind (the CLI falls back to the parent dir as
 * `projectDir`). Instead of the generic "empty project" view, show a clear message
 * naming the scanned root and the folders that were skipped. Renders nothing as
 * soon as any `openspec/`-bearing project exists, or outside parent mode.
 */
export function ProjectEmptyGate(): ReactNode {
  const { data: overview } = useProjectsOverview()

  const emptyFolders = useMemo(
    () => (overview?.projects ?? []).filter((project) => !project.hasOpenspec),
    [overview]
  )

  if (!overview?.parentMode) return null
  if (overview.projects.some((project) => project.hasOpenspec)) return null

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="border-border bg-background mx-4 max-w-xl space-y-4 rounded-lg border p-6 shadow-xl">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <FolderX className="h-5 w-5 text-amber-500" />
          No OpenSpec projects found
        </div>
        <p className="text-muted-foreground text-sm">
          No OpenSpec projects found under{' '}
          <code className="bg-muted rounded px-1">{overview.parentRoot}</code>. A project is any
          immediate subfolder that contains an{' '}
          <code className="bg-muted rounded px-1">openspec/</code> directory.
        </p>
        {emptyFolders.length > 0 ? (
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Scanned {emptyFolders.length} subfolder{emptyFolders.length === 1 ? '' : 's'}, none
              with an <code className="bg-muted rounded px-1">openspec/</code> directory:
            </p>
            <ul className="text-muted-foreground max-h-40 space-y-0.5 overflow-auto text-xs">
              {emptyFolders.map((folder) => (
                <li key={folder.path} className="truncate font-mono">
                  {folder.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Add an <code className="bg-muted rounded px-1">openspec/</code> folder to a subproject (run{' '}
          <code className="bg-muted rounded px-1">openspec init</code> there), then reload.
        </p>
      </div>
    </div>
  )
}
