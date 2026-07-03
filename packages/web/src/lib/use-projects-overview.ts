import { isStaticMode } from '@/lib/static-mode'
import { queryClient, trpcClient } from '@/lib/trpc'
import type { ProjectsOverview } from '@openspecui/core'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

/**
 * Shared read of the parent-mode project overview.
 *
 * Bound to the app's singleton QueryClient so callers work without a surrounding
 * QueryClientProvider (the switcher and the empty-state gate mount in the layout
 * shell and in isolated component tests). `refetchOnMount: 'always'` +
 * `refetchOnWindowFocus` mean a client mount/reload — including the full reload
 * A1's handoff performs — picks up the current sibling set (discovery is plain-fs,
 * so there is no subscription to keep it live).
 */
export function useProjectsOverview(): UseQueryResult<ProjectsOverview> {
  const staticMode = isStaticMode()
  return useQuery(
    {
      queryKey: ['projects', 'overview'],
      queryFn: () => trpcClient.projects.overview.query(),
      enabled: !staticMode,
      staleTime: 30 * 1000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    },
    queryClient
  )
}
