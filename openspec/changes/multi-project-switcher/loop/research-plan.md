## Research Findings

Objective facts from the codebase that constrain implementation (file:line).

### Startup + project binding
- CLI resolves a single project dir and hands it to the server: `packages/cli/src/cli.ts:78-79` (`resolve(originalCwd, rawDir)`) → `cli.ts:111-116` (`startServer({ projectDir, ... })`); default fallback `packages/cli/src/index.ts:166`.
- All project-scoped services are constructed **once** at bootstrap and captured as `const` closures: `packages/server/src/server.ts:586-599` (`ConfigManager`, `CliExecutor`, `OpsxKernel`) and `server.ts:145-151` (`OpenSpecAdapter`, `DocumentService`). `createContext` closes over those consts: `server.ts:431-453`.
- `ctx.projectDir` is immutable for the server lifetime: `Context` interface `packages/server/src/router.ts:117-139`; set from `config.projectDir` at context creation `server.ts:403-453`. There is **no** `switchProject`/`setProjectDir`/reinit path (`server.ts:546-556` only disposes on close).

### Reactivity + empty-state
- Watcher pool is a **global singleton** that already tolerates a directory change (closes old, inits new): `packages/core/src/reactive-fs/watcher-pool.ts:20-21,83-102`. Warmed in background: `server.ts:96-100`.
- `openspec/` presence check exists but is unused by any router procedure: `packages/core/src/adapter.ts:77-80` (`isInitialized()`); the UI has no dedicated init/empty component — `status-bar.tsx:105-128` merely renders the path; `mobile-header.tsx:18-20,37` renders `dirName`.

### Existing multi-instance handoff (the asset to reuse)
- Public API: `ensureWorktreeServer(input: { targetPath: string }): Promise<GitWorktreeHandoff>` — `packages/cli/src/worktree-instance-manager.ts:32-35`; return type `{ projectDir, serverUrl }` — `packages/server/src/git-panel-types.ts:78-81`.
- Spawn is **git-agnostic**: `createWorktreeServerLaunchPlan({ runtimeDir, projectDir, port })` needs only a dir + port — `worktree-instance-manager.ts:199-234`. The only git coupling is the client-facing mutation guard `resolveGitWorktreeSwitchTarget` — `router.ts:2470-2484` (path validation `router.ts:763-785`).
- Client trigger is an explicit user action (button), not automatic: `git.switchWorktree.mutate({ path })` `packages/web/src/.../git.tsx:100-102`, button `git.tsx:536-554`.
- Redirect is a full navigation preserving path/query/hash: `navigateToServerHandoff()` → `window.location.assign(buildServerHandoffHref(...))` `packages/web/src/.../server-handoff.ts:4-34`.
- Target list is served by `git.overview` (`currentWorktree` + `otherWorktrees`): `router.ts:2406-2409`, `git-panel-types.ts:72-76`. Manager wired in `packages/cli/src/index.ts:189-195`.

### Frontend project state
- No client-side project store; the web app is purely reactive to `system.subscribe` pushing `projectDir`: `packages/web/src/lib/use-server-status.ts:135-160`. Project-scoped subscriptions are established **once at mount and are NOT keyed by projectDir** (e.g. `use-dashboard.ts:8-24`, empty deps) → any in-place project switch would require a full page reload to re-establish them.
- Reusable UI primitive: Base-UI `Select` at `packages/web/src/components/select.tsx`.

### Reusable safety helper
- `isPathInsideOrEqual(parent, child)` (separator-agnostic containment) already exists in core (added by the Windows path-fix change) — use it to constrain switch targets to children of the launch dir.

## Decision & Plan (For Approval)

**Decision: Option A — generalize the existing multi-instance spawn + handoff to arbitrary sibling folders.**

Rationale: Option B (mutate `projectDir` in one running server) is HIGH effort *and* provides no UX benefit — because frontend subscriptions are one-time-at-mount, B still forces a full page reload. Option A reuses proven, isolated infrastructure (`createWorktreeServerLaunchPlan` + `navigateToServerHandoff`), guarantees zero cross-project state bleed (each project gets its own server/kernel/watcher), and mirrors the pattern users already have for worktrees. From the user's vantage it is still one `openspecui <parent>` launch with one top-bar dropdown; selecting a project reloads onto that project's server (identical to worktree switching today).

Shape: **A1 — the launched server adopts a default child as its own project** (mirroring `currentWorktree`), and lists sibling projects (mirroring `otherWorktrees`). This keeps the launched server a fully-functional project server and the dropdown available from every project.

Plan (each numbered item ≈ one commit unit; see `checkpoints.md`):

1. **Core — sibling discovery.** Add `discoverProjectRoots(launchDir)` in `packages/core/src` returning `{ isParentMode, parentRoot, projects: { name, path, hasOpenspec }[], defaultProjectPath }`. Rules: scan **immediate** children only; `hasOpenspec` = `<child>/openspec` is a directory; `isParentMode` = launchDir has no own `openspec/` AND ≥1 child has one; `defaultProjectPath` = first `hasOpenspec` child sorted by name. Single-project (launchDir has `openspec/`) → `isParentMode:false`, `projects:[launchDir]`. Reuse `getRealPath`.

2. **CLI — parent-mode wiring.** In `cli.ts`, after resolving `launchDir`, call discovery. If `isParentMode`, set the effective `projectDir = defaultProjectPath` and pass a new `parentContext: { parentRoot, projects }` into `startServer`. Otherwise unchanged.

3. **Server — `projects` router + generalized switch.** Add optional `parentContext` to `ServerConfig`; expose it on `Context`. New `projectsRouter`: `overview` query + `subscribe` (reactive over `parentRoot`) returning `{ parentRoot, currentProjectPath, projects }` (filtered to `hasOpenspec` unless `includeEmpty:true`); `switchProject({ path })` mutation that (a) validates `path` is a discovered child with `openspec/` and `isPathInsideOrEqual(parentRoot, path)`, then (b) calls the generalized instance manager and returns `{ serverUrl }`.

4. **CLI — generalize the instance manager.** Allow spawning a server for any validated sibling path (not just git worktrees): add `ensureProjectServer({ targetPath })` (or relax the existing guard) reusing `createWorktreeServerLaunchPlan`, and **forward `parentContext`** into the spawned child server's config so every project shows the same dropdown and can switch onward. Keep git worktree switching intact (parallel, not replaced).

5. **Web — top-bar Project dropdown.** New header component using `components/select.tsx`, data from `projects.subscribe`, current project marked active; `onChange` → `projects.switchProject.mutate({ path })` → `navigateToServerHandoff({ serverUrl })`. Empties hidden by default with a "show folders without openspec" toggle (revealed entries are disabled — selecting them is a non-goal). Mount in `mobile-header.tsx` and the desktop header.

6. **Empty-state polish.** When `isParentMode` but zero children have `openspec/`, show a clear "no OpenSpec projects found under <parentRoot>" message instead of the generic empty view.

## Capability Impact

### New or Expanded Behavior
- Parent-mode detection + immediate-child project discovery (core).
- `projects` tRPC router (`overview` / `subscribe` / `switchProject`).
- Top-bar project selector dropdown (web), hides non-project children by default.
- Instance manager can spawn/hand off to arbitrary sibling project folders (cli), forwarding parent context to children.

### Modified Behavior
- CLI startup: when the launch dir lacks `openspec/`, the server now adopts a default child project instead of rendering an empty/not-found state.
- `ServerConfig`/`Context` gain optional `parentContext`.
- Empty-state messaging clarified for the "parent with no projects" case.

## Risks and Mitigations
- **Cross-project state bleed** → eliminated by construction: each project runs its own isolated server (own kernel/watcher/adapter).
- **Arbitrary-path server spawn (security)** → `switchProject` only accepts targets that are discovered children AND pass `isPathInsideOrEqual(parentRoot, path)` AND contain `openspec/`; reject everything else.
- **Spawned child lacks the sibling list** → thread `parentContext` through `createWorktreeServerLaunchPlan` into the child `ServerConfig`; cover with a test asserting a spawned child's `projects.overview` matches the parent's.
- **Port growth with many children** → spawn lazily on first switch and memoize in the existing instances `Map` (already the manager's behavior).
- **Windows path correctness** → route every containment/normalization through `getRealPath` + `isPathInsideOrEqual` (no raw `startsWith(x + '/')`).
- **Regression of git worktree switching** → keep the git path (`git.overview` / `git.switchWorktree`) untouched; the `projects` router is additive.

## Verification Strategy
- **Local checks**: `pnpm --filter @openspecui/core --filter @openspecui/server --filter @openspecui/web --filter openspecui build`, `pnpm -r test` (touched packages), `pnpm tc`, `pnpm lint`. Add a **minor** changeset for the affected packages (user-facing feature).
- **Unit tests**: core discovery (mixed children, single-project passthrough, empties hidden, Windows-style paths); server `switchProject` guard (accepts a discovered project, rejects a non-project / outside-parent path); generalized instance spawn for a non-git sibling; child inherits `parentContext`.
- **Web tests**: dropdown lists only `hasOpenspec` projects by default, reveal-toggle shows disabled empties, selecting a project invokes the mutation + navigation (mocked).
- **Manual acceptance** (matches intake Acceptance Boundary): temp parent with `A/openspec`, `B/openspec`, `C/` (no openspec) → launch `openspecui <parent>`; dropdown shows A + B, not C; A active by default; select B → reload onto B's server, B data live; launch `openspecui <A>` directly → unchanged single-project behavior.
