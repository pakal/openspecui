import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { inferFileMime, inferFilePreviewKind, isTextLikeFile } from './file-preview.js'
import {
  buildOpsxEntityDetail,
  normalizeOpsxEntityPath,
  parseOpsxEntityMetadata,
  type OpsxEntityDetail,
  type OpsxEntityReadOptions,
} from './opsx-entity.js'
import { parseOpsxSchemaDetail } from './opsx-schema-detail.js'
import { MarkdownParser } from './parser.js'
import { reactiveReadDir, reactiveReadFile, reactiveStat } from './reactive-fs/index.js'
import type { Change, ChangeFile, DeltaSpec, Spec } from './schemas.js'
import {
  projectTasksFromMarkdownFiles,
  type TaskProgress,
  type TaskProjection,
} from './task-progress.js'
import { Validator, type ValidationResult } from './validator.js'

/** Spec metadata with time info */
export interface SpecMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

/** Change metadata with time info */
export interface ChangeMeta {
  id: string
  name: string
  progress: TaskProgress
  createdAt: number
  updatedAt: number
}

/** Archived change metadata with time info */
export interface ArchiveMeta {
  id: string
  name: string
  progress: TaskProgress
  createdAt: number
  updatedAt: number
}

/**
 * OpenSpec filesystem adapter
 * Handles reading, writing, and managing OpenSpec files
 */
export class OpenSpecAdapter {
  private parser = new MarkdownParser()
  private validator = new Validator()

  constructor(private projectDir: string) {}

  private get openspecDir() {
    return join(this.projectDir, 'openspec')
  }

  private get specsDir() {
    return join(this.openspecDir, 'specs')
  }

  private get changesDir() {
    return join(this.openspecDir, 'changes')
  }

  private get archiveDir() {
    return join(this.changesDir, 'archive')
  }

  // =====================
  // Existence checks
  // =====================

  async isInitialized(): Promise<boolean> {
    const statInfo = await reactiveStat(this.openspecDir)
    return statInfo?.isDirectory ?? false
  }

  // =====================
  // File time utilities
  // =====================

  /** File time info derived from filesystem (reactive) */
  private async getFileTimeInfo(
    filePath: string
  ): Promise<{ createdAt: number; updatedAt: number } | null> {
    const statInfo = await reactiveStat(filePath)
    if (!statInfo) return null
    return {
      createdAt: statInfo.birthtime,
      updatedAt: statInfo.mtime,
    }
  }

  // =====================
  // Spec layout resolution
  // =====================

  /**
   * Enumerate every spec under specs/, supporting both the canonical
   * `specs/<id>/spec.md` layout and the nested `specs/<topic>/<feature>.md`
   * layout (multiple specs per topic directory). Reactive: each visited
   * directory is read through the reactive layer so the UI refreshes on change.
   */
  private async enumerateSpecs(): Promise<Array<{ id: string; absPath: string }>> {
    return this.collectSpecFiles(this.specsDir, '')
  }

  /** Recursively collect spec files, deriving each id from its path relative to specs/. */
  private async collectSpecFiles(
    dir: string,
    relPrefix: string
  ): Promise<Array<{ id: string; absPath: string }>> {
    const entries = await reactiveReadDir(dir)
    const collected: Array<{ id: string; absPath: string }> = []
    for (const entry of entries) {
      const absPath = join(dir, entry)
      const statInfo = await reactiveStat(absPath)
      if (statInfo?.isDirectory) {
        const childPrefix = relPrefix ? `${relPrefix}/${entry}` : entry
        collected.push(...(await this.collectSpecFiles(absPath, childPrefix)))
      } else if (statInfo?.isFile && entry.endsWith('.md')) {
        // `spec.md` keeps the canonical id (= its directory); any other markdown
        // file is a nested spec whose id includes the file stem.
        if (entry === 'spec.md') {
          if (relPrefix) collected.push({ id: relPrefix, absPath })
        } else {
          const stem = entry.slice(0, -'.md'.length)
          const id = relPrefix ? `${relPrefix}/${stem}` : stem
          collected.push({ id, absPath })
        }
      }
    }
    return collected
  }

  /**
   * Resolve the on-disk file for a spec id. Prefers the canonical
   * `specs/<id>/spec.md`, then falls back to the nested `specs/<id>.md`.
   * Returns absolute + openspec-relative (posix-separated) paths, or null if neither exists.
   */
  async resolveSpecFile(
    specId: string
  ): Promise<{ absolutePath: string; relativePath: string } | null> {
    const canonicalAbs = join(this.specsDir, specId, 'spec.md')
    const canonicalStat = await reactiveStat(canonicalAbs)
    if (canonicalStat?.isFile) {
      return { absolutePath: canonicalAbs, relativePath: `openspec/specs/${specId}/spec.md` }
    }
    const nestedAbs = join(this.specsDir, `${specId}.md`)
    const nestedStat = await reactiveStat(nestedAbs)
    if (nestedStat?.isFile) {
      return { absolutePath: nestedAbs, relativePath: `openspec/specs/${specId}.md` }
    }
    return null
  }

  // =====================
  // List operations
  // =====================

  async listSpecs(): Promise<string[]> {
    const specs = await this.enumerateSpecs()
    return specs.map((spec) => spec.id)
  }

  /**
   * List specs with metadata (id, name, and time info), across both the canonical
   * and nested spec layouts. Only returns specs whose markdown parses.
   * Sorted by updatedAt descending (most recent first)
   */
  async listSpecsWithMeta(): Promise<SpecMeta[]> {
    const entries = await this.enumerateSpecs()
    const results = await Promise.all(
      entries.map(async ({ id, absPath }) => {
        const spec = await this.readSpec(id)
        if (!spec) return null
        const timeInfo = await this.getFileTimeInfo(absPath)
        return {
          id,
          name: spec.name,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results
      .filter((r): r is SpecMeta => r !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listChanges(): Promise<string[]> {
    return reactiveReadDir(this.changesDir, { directoriesOnly: true, exclude: ['archive'] })
  }

  /**
   * List changes with metadata (id, name, progress, and time info)
   * Returns every change directory, including schema-specific layouts that
   * don't use proposal.md/tasks.md.
   * Sorted by updatedAt descending (most recent first)
   */
  async listChangesWithMeta(): Promise<ChangeMeta[]> {
    const ids = await this.listChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const changeDir = join(this.changesDir, id)
        const [change, taskProjection, timeInfo] = await Promise.all([
          this.readChange(id),
          this.readChangeTaskProjection(id),
          this.getFileTimeInfo(changeDir),
        ])
        return {
          id,
          // Legacy parser can be unavailable for custom schemas; keep the
          // change visible with objective fallback metadata.
          name: change?.name ?? id,
          progress: taskProjection.progress,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listArchivedChanges(): Promise<string[]> {
    return reactiveReadDir(this.archiveDir, { directoriesOnly: true })
  }

  /**
   * List archived changes with metadata and time info
   * Returns every archive directory, including schema-specific layouts that
   * don't use proposal.md/tasks.md.
   * Sorted by updatedAt descending (most recent first)
   */
  async listArchivedChangesWithMeta(): Promise<ArchiveMeta[]> {
    const ids = await this.listArchivedChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const archiveDir = join(this.archiveDir, id)
        const [taskProjection, timeInfo] = await Promise.all([
          this.readArchivedChangeTaskProjection(id),
          this.getFileTimeInfo(archiveDir),
        ])
        return {
          id,
          name: id,
          progress: taskProjection.progress,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  // =====================
  // Project files
  // =====================

  /**
   * Read project.md content (reactive)
   */
  async readProjectMd(): Promise<string | null> {
    const projectPath = join(this.openspecDir, 'project.md')
    return reactiveReadFile(projectPath)
  }

  /**
   * Write project.md content
   */
  async writeProjectMd(content: string): Promise<void> {
    const projectPath = join(this.openspecDir, 'project.md')
    await writeFile(projectPath, content, 'utf-8')
  }

  // =====================
  // Read operations
  // =====================

  async readSpec(specId: string): Promise<Spec | null> {
    try {
      const content = await this.readSpecRaw(specId)
      if (!content) return null
      return this.parser.parseSpec(specId, content)
    } catch {
      return null
    }
  }

  async readSpecRaw(specId: string): Promise<string | null> {
    const resolved = await this.resolveSpecFile(specId)
    if (!resolved) return null
    return reactiveReadFile(resolved.absolutePath)
  }

  async readChange(changeId: string): Promise<Change | null> {
    try {
      const raw = await this.readChangeRaw(changeId)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal, raw.tasks, {
        design: raw.design,
        deltaSpecs: raw.deltaSpecs,
      })
    } catch {
      return null
    }
  }

  async readChangeFiles(changeId: string): Promise<ChangeFile[]> {
    const changeRoot = join(this.changesDir, changeId)
    return this.readFilesUnderRoot(changeRoot)
  }

  async readArchivedChangeFiles(changeId: string): Promise<ChangeFile[]> {
    const archiveRoot = join(this.archiveDir, changeId)
    return this.readFilesUnderRoot(archiveRoot)
  }

  async readChangeTaskProjection(changeId: string): Promise<TaskProjection> {
    return this.readEntityTaskProjection(join(this.changesDir, changeId))
  }

  async readArchivedChangeTaskProjection(changeId: string): Promise<TaskProjection> {
    return this.readEntityTaskProjection(join(this.archiveDir, changeId))
  }

  async readEntityDetail(
    stage: 'change' | 'archive',
    id: string,
    options: OpsxEntityReadOptions = {}
  ): Promise<OpsxEntityDetail | null> {
    const root = stage === 'change' ? join(this.changesDir, id) : join(this.archiveDir, id)
    const files = await this.readFilesUnderRoot(root)
    if (files.length === 0) {
      const statInfo = await reactiveStat(root)
      if (!statInfo?.isDirectory) return null
    }
    return buildOpsxEntityDetail({
      stage,
      id,
      files,
      schemas: options.schemas,
      schemaDiagnostics: options.schemaDiagnostics,
    })
  }

  private async readFilesUnderRoot(root: string): Promise<ChangeFile[]> {
    const rootStat = await reactiveStat(root)
    if (!rootStat?.isDirectory) return []

    const entries = await this.collectChangeFiles(root, root)

    return entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.path.localeCompare(b.path)
    })
  }

  private async collectChangeFiles(root: string, dir: string): Promise<ChangeFile[]> {
    const names = await reactiveReadDir(dir, { includeHidden: true })
    const files: ChangeFile[] = []

    for (const name of names) {
      const fullPath = join(dir, name)
      const statInfo = await reactiveStat(fullPath)
      if (!statInfo) continue

      // ChangeFile.path is a posix-separated openspec-relative path; `slice` keeps
      // the native separator (`\` on Windows), so normalize before storing/matching.
      const relativePath = normalizeOpsxEntityPath(fullPath.slice(root.length + 1))

      if (statInfo.isDirectory) {
        files.push({ path: relativePath, type: 'directory' })
        files.push(...(await this.collectChangeFiles(root, fullPath)))
      } else {
        const mime = inferFileMime(relativePath) ?? undefined
        const previewKind = inferFilePreviewKind(relativePath, mime)
        const content = isTextLikeFile(relativePath, mime) ? await reactiveReadFile(fullPath) : null
        files.push({ path: relativePath, type: 'file', content: content ?? undefined })
        files[files.length - 1] = {
          ...files[files.length - 1]!,
          mime,
          previewKind,
          size: undefined,
        }
      }
    }

    return files
  }

  private async readProjectSchemaDetail(schemaName: string) {
    const schemaPath = join(this.openspecDir, 'schemas', schemaName, 'schema.yaml')
    const schemaContent = await reactiveReadFile(schemaPath)
    if (!schemaContent) return null
    return parseOpsxSchemaDetail(schemaContent, schemaName, {
      path: `openspec/schemas/${schemaName}/schema.yaml`,
    }).detail
  }

  private async readEntityTaskProjection(root: string): Promise<TaskProjection> {
    const files = await this.readFilesUnderRoot(root)
    const metadataContent =
      files.find((file) => file.type === 'file' && file.path === '.openspec.yaml')?.content ?? null
    const metadata = parseOpsxEntityMetadata(metadataContent)
    const schemaDetail = metadata.schemaName
      ? await this.readProjectSchemaDetail(metadata.schemaName)
      : null

    return projectTasksFromMarkdownFiles(files, {
      schemaDetail,
      hasSchemaMetadata: Boolean(metadata.schemaName),
    })
  }

  async readChangeRaw(
    changeId: string
  ): Promise<{ proposal: string; tasks: string; design?: string; deltaSpecs: DeltaSpec[] } | null> {
    const changeDir = join(this.changesDir, changeId)
    const proposalPath = join(changeDir, 'proposal.md')
    const tasksPath = join(changeDir, 'tasks.md')
    const designPath = join(changeDir, 'design.md')
    const specsDir = join(changeDir, 'specs')

    const [proposal, tasks, design] = await Promise.all([
      reactiveReadFile(proposalPath),
      reactiveReadFile(tasksPath),
      reactiveReadFile(designPath),
    ])

    if (!proposal) return null

    // Read delta specs from specs/ directory
    const deltaSpecs = await this.readDeltaSpecs(specsDir)

    return {
      proposal,
      tasks: tasks ?? '',
      design: design ?? undefined,
      deltaSpecs,
    }
  }

  /** Read delta specs from a change's specs directory (canonical or nested layout). */
  private async readDeltaSpecs(specsDir: string): Promise<DeltaSpec[]> {
    const specFiles = await this.collectSpecFiles(specsDir, '')
    const deltaSpecs: DeltaSpec[] = []

    for (const { id, absPath } of specFiles) {
      const content = await reactiveReadFile(absPath)
      if (content) {
        deltaSpecs.push({ specId: id, content })
      }
    }

    return deltaSpecs
  }

  /**
   * Read an archived change
   */
  async readArchivedChange(changeId: string): Promise<Change | null> {
    try {
      const raw = await this.readArchivedChangeRaw(changeId)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal, raw.tasks, {
        design: raw.design,
        deltaSpecs: raw.deltaSpecs,
      })
    } catch {
      return null
    }
  }

  /**
   * Read raw archived change files (reactive)
   */
  async readArchivedChangeRaw(
    changeId: string
  ): Promise<{ proposal: string; tasks: string; design?: string; deltaSpecs: DeltaSpec[] } | null> {
    const archiveChangeDir = join(this.archiveDir, changeId)
    const proposalPath = join(archiveChangeDir, 'proposal.md')
    const tasksPath = join(archiveChangeDir, 'tasks.md')
    const designPath = join(archiveChangeDir, 'design.md')
    const specsDir = join(archiveChangeDir, 'specs')

    const [proposal, tasks, design] = await Promise.all([
      reactiveReadFile(proposalPath),
      reactiveReadFile(tasksPath),
      reactiveReadFile(designPath),
    ])

    if (!proposal) return null

    // Read delta specs from specs/ directory
    const deltaSpecs = await this.readDeltaSpecs(specsDir)

    return {
      proposal,
      tasks: tasks ?? '',
      design: design ?? undefined,
      deltaSpecs,
    }
  }

  // =====================
  // Write operations
  // =====================

  async writeSpec(specId: string, content: string): Promise<void> {
    const resolved = await this.resolveSpecFile(specId)
    if (resolved) {
      // Write back to wherever the spec already lives (canonical or nested).
      await writeFile(resolved.absolutePath, content, 'utf-8')
      return
    }
    // New spec: a slash in the id means the nested `<id>.md` layout; otherwise
    // default to the canonical `<id>/spec.md` layout.
    if (specId.includes('/')) {
      const nestedAbs = join(this.specsDir, `${specId}.md`)
      await mkdir(dirname(nestedAbs), { recursive: true })
      await writeFile(nestedAbs, content, 'utf-8')
      return
    }
    const specDir = join(this.specsDir, specId)
    await mkdir(specDir, { recursive: true })
    await writeFile(join(specDir, 'spec.md'), content, 'utf-8')
  }

  async writeChange(changeId: string, proposal: string, tasks?: string): Promise<void> {
    const changeDir = join(this.changesDir, changeId)
    await mkdir(changeDir, { recursive: true })
    await writeFile(join(changeDir, 'proposal.md'), proposal, 'utf-8')
    if (tasks !== undefined) {
      await writeFile(join(changeDir, 'tasks.md'), tasks, 'utf-8')
    }
  }

  // =====================
  // Archive operations
  // =====================

  async archiveChange(changeId: string): Promise<boolean> {
    try {
      const changeDir = join(this.changesDir, changeId)
      const archivePath = join(this.archiveDir, changeId)

      await mkdir(this.archiveDir, { recursive: true })
      await rename(changeDir, archivePath)
      return true
    } catch {
      return false
    }
  }

  // =====================
  // Init operations
  // =====================

  async init(): Promise<void> {
    await mkdir(this.specsDir, { recursive: true })
    await mkdir(this.changesDir, { recursive: true })
    await mkdir(this.archiveDir, { recursive: true })

    const projectMd = `# Project Specification

## Overview
This project uses OpenSpec for spec-driven development.

## Structure
- \`specs/\` - Source of truth specifications
- \`changes/\` - Active change proposals
- \`changes/archive/\` - Completed changes
`
    await writeFile(join(this.openspecDir, 'project.md'), projectMd, 'utf-8')
  }

  // =====================
  // Task operations
  // =====================

  /**
   * Toggle a task's completion status in tasks.md
   * @param changeId - The change ID
   * @param taskIndex - 1-based task index
   * @param completed - New completion status
   */
  async toggleTask(changeId: string, taskIndex: number, completed: boolean): Promise<boolean> {
    try {
      const tasksPath = join(this.changesDir, changeId, 'tasks.md')
      const content = await readFile(tasksPath, 'utf-8')

      const lines = content.split('\n')
      let currentTaskIndex = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match task lines: - [ ] or - [x] or * [ ] or * [x]
        const taskMatch = line.match(/^([-*]\s+)\[([ xX])\](\s+.*)$/)
        if (taskMatch) {
          currentTaskIndex++
          if (currentTaskIndex === taskIndex) {
            // Update the checkbox
            const prefix = taskMatch[1]
            const suffix = taskMatch[3]
            const newCheckbox = completed ? '[x]' : '[ ]'
            lines[i] = `${prefix}${newCheckbox}${suffix}`
            break
          }
        }
      }

      if (currentTaskIndex < taskIndex) {
        return false // Task not found
      }

      await writeFile(tasksPath, lines.join('\n'), 'utf-8')
      return true
    } catch {
      return false
    }
  }

  // =====================
  // Validation
  // =====================

  async validateSpec(specId: string): Promise<ValidationResult> {
    const spec = await this.readSpec(specId)
    if (!spec) {
      return {
        valid: false,
        issues: [{ severity: 'ERROR', message: `Spec '${specId}' not found` }],
      }
    }
    return this.validator.validateSpec(spec)
  }

  async validateChange(changeId: string): Promise<ValidationResult> {
    const change = await this.readChange(changeId)
    if (!change) {
      return {
        valid: false,
        issues: [{ severity: 'ERROR', message: `Change '${changeId}' not found` }],
      }
    }
    return this.validator.validateChange(change)
  }

  // =====================
  // Dashboard data
  // =====================

  async getDashboardData() {
    const [specIds, changeIds, archivedIds] = await Promise.all([
      this.listSpecs(),
      this.listChanges(),
      this.listArchivedChanges(),
    ])

    const specs = await Promise.all(specIds.map((id) => this.readSpec(id)))
    const changes = await Promise.all(changeIds.map((id) => this.readChange(id)))

    const validSpecs = specs.filter((s): s is Spec => s !== null)
    const validChanges = changes.filter((c): c is Change => c !== null)

    const totalRequirements = validSpecs.reduce((sum, s) => sum + s.requirements.length, 0)
    const totalTasks = validChanges.reduce((sum, c) => sum + c.progress.total, 0)
    const completedTasks = validChanges.reduce((sum, c) => sum + c.progress.completed, 0)

    return {
      specs: validSpecs,
      changes: validChanges,
      archivedCount: archivedIds.length,
      summary: {
        specCount: validSpecs.length,
        requirementCount: totalRequirements,
        activeChangeCount: validChanges.length,
        archivedChangeCount: archivedIds.length,
        totalTasks,
        completedTasks,
        progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
    }
  }
}
