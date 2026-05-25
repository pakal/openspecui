import { realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/**
 * Resolve a filesystem path through the closest existing ancestor.
 *
 * Missing descendants still need the same realpath prefix as watcher events,
 * otherwise symlinked roots such as `/var` -> `/private/var` stop matching
 * once the path is created later.
 */
export function resolveRealPathThroughExistingAncestor(path: string): string {
  const absolutePath = resolve(path)
  const missingSegments: string[] = []
  let currentPath = absolutePath

  while (true) {
    try {
      const realPath = realpathSync(currentPath)
      return missingSegments.length === 0 ? realPath : join(realPath, ...missingSegments.reverse())
    } catch {
      const parentPath = dirname(currentPath)
      if (parentPath === currentPath) {
        return absolutePath
      }
      missingSegments.push(basename(currentPath))
      currentPath = parentPath
    }
  }
}
