/**
 * Separator-agnostic path containment check.
 *
 * Native filesystem paths use `\` on Windows and `/` on POSIX. Comparing a
 * resolved path against a parent prefix must not hardcode `/`, or the guard
 * silently fails on Windows (e.g. watcher event matching, entity-root escape
 * checks, preview asset guards). This treats both `/` and `\` as boundaries so
 * the same code is correct on every OS — and testable for either separator on
 * any host.
 *
 * @param parent absolute parent path (no trailing separator)
 * @param child absolute candidate path
 * @returns true when `child` equals `parent` or is nested under it
 */
export function isPathInsideOrEqual(parent: string, child: string): boolean {
  if (child === parent) return true
  if (!child.startsWith(parent)) return false
  const boundary = child.charAt(parent.length)
  return boundary === '/' || boundary === '\\'
}
