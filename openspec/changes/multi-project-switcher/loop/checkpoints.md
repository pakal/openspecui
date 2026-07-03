## 1. Research and Planning

- [x] 1.1 Intake captured objectively (`loop/intake.md`)
- [x] 1.2 Research facts recorded with file:line evidence (`loop/research-plan.md` → Research Findings)
- [x] 1.3 Plan reviewed and approved by user (Option A / A1 confirmed — reload-onto-project's-server accepted)

## 2. Implementation

Each item is one commit unit, mapping to a numbered step in `research-plan.md` → *Decision & Plan*. Build + `pnpm -r test` + `pnpm tc` + `pnpm lint` must be green before its commit.

- [x] 2.1 **Core — sibling discovery.** Add `discoverProjectRoots(launchDir)` to `@openspecui/core` returning `{ isParentMode, parentRoot, projects[], defaultProjectPath }` (immediate children only; `hasOpenspec` = `<child>/openspec` is a dir; single-project passthrough). Unit tests: mixed children, single-project passthrough, empties flagged, Windows-style paths. Export from core public entry.
- [x] 2.2 **CLI — parent-mode wiring.** In `packages/cli/src/cli.ts`, run discovery after resolving `launchDir`; when `isParentMode`, set effective `projectDir = defaultProjectPath` and pass `parentContext: { parentRoot, projects }` into `startServer`. Single-project path unchanged.
- [x] 2.3 **Server — `projects` router + config.** Add optional `parentContext` to `ServerConfig` + expose on `Context`. New `projectsRouter`: `overview` query, `switchProject({ path })` mutation guarded by `isPathInsideOrEqual(parentRoot, path)` + `openspec/` existence → instance manager → `{ serverUrl }`. Tests (in `packages/server/src/router.test.ts` → `describe('projectsRouter (multi-project switcher)')`): overview lists children with `hasOpenspec` flags in parent mode + single self-referential entry in single-project mode; `switchProject` hands off to a discovered openspec sibling, rejects a non-openspec sibling, rejects an outside-parent path, and is unavailable in single-project mode. (`subscribe` dropped — see `implementation.md` Divergence: the child watcher can never observe siblings, so `overview` is read fresh per mount.)
- [x] 2.4 **CLI — generalize instance manager.** Spawn/hand off to any validated sibling path via `createWorktreeServerLaunchPlan`; forward `parentContext` into the spawned child `ServerConfig`. Keep git worktree switching intact. Test: a spawned child's `projects.overview` matches the parent's.
- [x] 2.5 **Web — top-bar project dropdown.** New header component (reuse `components/select.tsx`), data from `projects.overview`; `onChange` → `switchProject.mutate` → `navigateToServerHandoff`. Empties hidden by default (reveal toggle shows them disabled). Mount in `mobile-header.tsx` + desktop sidebar. Tests: lists only `hasOpenspec` by default, reveal shows disabled empties, select triggers mutation + navigation (mocked).
- [x] 2.6 **Empty-state polish.** Parent mode with zero `openspec/` children → `ProjectEmptyGate` full-screen message "No OpenSpec projects found under <parentRoot>" (naming the skipped folders), not the generic empty view.
- [x] 2.7 Progress synchronized with `implementation.md` (State / Decisions / Divergence updated as work lands)
- [ ] 2.8 Unexpected blockers loop back to intake/research-plan per `implementation.md` → Loopback Triggers

## 3. PR and Release Gates

- [x] 3.1 **Minor** changeset added for user-facing feature across affected packages (`@openspecui/core`, `@openspecui/server`, `@openspecui/web`, `openspecui`)
- [x] 3.2 CI-equivalent local checks pass: `pnpm build`, `pnpm -r test`, `pnpm tc`, `pnpm lint` (feature tests all green — core `project-discovery` 5/5, server `router.test.ts` 49/49 incl. 6 new 2.3 guard tests, web 9/9; remaining reds are pre-existing Windows/env baseline — see `implementation.md` Divergence)
- [ ] 3.3 Manual acceptance run passes all 5 intake Acceptance-Boundary criteria (parent A+B listed, C hidden, runtime switch reload works + reactive, single-project regression-free, no cross-project bleed)

## 4. Merge Readiness

- [ ] 4.1 OpenSpec archive flow completed for `multi-project-switcher`
- [ ] 4.2 PR opened + reviewed + merge approved (no push/PR without explicit user OK)
