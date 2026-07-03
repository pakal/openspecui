import { readdir, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

/** A candidate project folder discovered under a launch directory. */
export interface ProjectRoot {
  /** Immediate-child directory name (display label). */
  name: string
  /** Absolute, resolved path to the folder. */
  path: string
  /** True when the folder owns an `openspec/` subdirectory (a switchable project). */
  hasOpenspec: boolean
}

/**
 * The parent-mode context threaded from the CLI into every (root or spawned-child)
 * server so each one can render the project switcher and hand off to siblings.
 */
export interface ParentProjectContext {
  /** Absolute launch directory whose children are the candidate projects. */
  parentRoot: string
  /** All immediate-child candidates (project + non-project), for switch validation + reveal. */
  projects: ProjectRoot[]
}

/** Result of scanning a launch directory for switchable OpenSpec projects. */
export interface ProjectDiscovery {
  /**
   * True when the launch directory itself lacks an `openspec/` folder, so the app
   * treats immediate children as candidate projects. False = classic single-project.
   */
  isParentMode: boolean
  /** Absolute, resolved launch directory (the scan root). */
  parentRoot: string
  /**
   * Candidate projects. In parent mode: every immediate child directory (with its
   * `hasOpenspec` flag). In single-project mode: exactly the launch directory.
   */
  projects: ProjectRoot[]
  /**
   * The project the launched server should bind by default: in single-project mode
   * the launch dir; in parent mode the first `hasOpenspec` child by name, or `null`
   * when no child qualifies (empty parent).
   */
  defaultProjectPath: string | null
}

/**
 * Wire payload for the `projects` router: the current project plus every sibling
 * candidate, so the web dropdown can list projects and (optionally) reveal empties.
 */
export interface ProjectsOverview {
  /** True when the server was launched in parent mode (children are candidate projects). */
  parentMode: boolean
  /** Absolute launch/scan root, or `null` in single-project mode. */
  parentRoot: string | null
  /** Absolute path of the project this server is currently bound to. */
  currentProjectPath: string
  /** Display name of the current project (its directory basename). */
  currentProjectName: string
  /** All candidate projects (each with its `hasOpenspec` flag for the reveal toggle). */
  projects: ProjectRoot[]
}

/** True when `<dirPath>/openspec` resolves to a directory. */
async function directoryHasOpenspec(dirPath: string): Promise<boolean> {
  try {
    const info = await stat(resolve(dirPath, 'openspec'))
    return info.isDirectory()
  } catch {
    return false
  }
}

/** Immediate, non-hidden child directory names of `dirPath` (empty when unreadable). */
async function readChildDirectoryNames(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

/**
 * Scan `launchDir` for switchable OpenSpec projects.
 *
 * - If `launchDir` owns an `openspec/` folder → single-project mode (unchanged
 *   classic behavior); the sole project is the launch dir itself.
 * - Otherwise → parent mode: enumerate **immediate** child directories only (no
 *   recursion) and flag each with whether it contains `openspec/`. The default
 *   project is the first `openspec/`-bearing child sorted by name.
 *
 * Uses plain `node:fs` (not reactive-fs): the launched server's file watcher is
 * scoped to its own project dir, so it can never observe parent/sibling changes.
 * Reading fresh on every call keeps the project list current across reloads
 * instead of pinning a permanently-stale reactive-fs cache entry.
 */
export async function discoverProjectRoots(launchDir: string): Promise<ProjectDiscovery> {
  const parentRoot = resolve(launchDir)

  // Single-project passthrough: the launch dir is itself an OpenSpec project.
  if (await directoryHasOpenspec(parentRoot)) {
    return {
      isParentMode: false,
      parentRoot,
      projects: [{ name: basename(parentRoot), path: parentRoot, hasOpenspec: true }],
      defaultProjectPath: parentRoot,
    }
  }

  // Parent mode: scan immediate child directories (deterministic name order).
  const childNames = await readChildDirectoryNames(parentRoot)
  const sortedNames = [...childNames].sort((left, right) => left.localeCompare(right))

  const projects: ProjectRoot[] = []
  for (const name of sortedNames) {
    const childPath = resolve(parentRoot, name)
    const hasOpenspec = await directoryHasOpenspec(childPath)
    projects.push({ name, path: childPath, hasOpenspec })
  }

  const firstProject = projects.find((project) => project.hasOpenspec) ?? null

  return {
    isParentMode: true,
    parentRoot,
    projects,
    defaultProjectPath: firstProject?.path ?? null,
  }
}
