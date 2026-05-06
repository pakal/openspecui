## Research Findings

- `packages/web/src/routes/git.tsx` owns the live Git page and renders "Other Worktrees" as a two-column large-screen grid with a text `Switch worktree` button below each `WorktreeRow`.
- `WorktreeRow` in `packages/web/src/components/git/git-shared.tsx` already has compact path, copy, remove, diff, and ahead/behind controls; the switch action is intentionally outside the row.
- `packages/web/src/components/layout/desktop-sidebar.tsx` owns desktop sidebar rendering for both static and live IDE modes.
- `AreaNav` owns draggable main/bottom nav sections. Drag state and drop affordances are local to that component, so collapsed sidebar drag hiding can be expressed as a presentation/interaction prop without changing `navController`.
- `navController` stores tab topology and locations. Sidebar collapse is a shell preference, not a tab-layout rule, and should not be persisted through remote nav layout KV.
- The web package already depends on `lucide-react` and has a shared `Tooltip` component, so no new UI dependency is needed.

## Decision & Plan (For Approval)

- Treat this as a front-end shell/UI atom under existing navigation and Git handoff laws.
- Add a local desktop sidebar collapsed preference, defaulting to expanded and persisted in browser local storage with hosted scoping.
- Render the desktop sidebar with expanded and collapsed width variants. Collapsed mode hides logo/text labels and uses icon-only controls with `aria-label`/`title`/tooltip.
- Extend `AreaNav` with `collapsed?: boolean`; when collapsed, render icon-only nav and disable draggable/drop behavior and grip handles.
- Refactor the Git page other-worktree block so summary/action content wraps naturally and the switch action is a compact icon button.
- Add focused unit coverage and real-browser acceptance for the changed surfaces.
- Add a patch changeset for `@openspecui/web` because publishable UI behavior changes.

## Capability Impact

### New or Expanded Behavior

- Desktop users can collapse and expand the sidebar.
- Collapsed desktop sidebar provides an icon-only navigation rail while preserving accessible names.
- Git worktree switch action is compact enough for narrow bottom-area layouts.

### Modified Behavior

- Desktop sidebar drag-and-drop nav affordances are hidden and disabled only while the sidebar is collapsed.
- Other worktree cards in the Git page use more responsive wrapping instead of relying on a wide text switch button.

## Risks and Mitigations

- Risk: collapsed nav becomes inaccessible because visible labels are removed. Mitigation: keep `aria-label`, `title`, and tooltip labels on icon-only controls.
- Risk: disabling drag in collapsed mode changes tab layout behavior globally. Mitigation: keep the rule in `AreaNav` presentation only and do not mutate `navController`.
- Risk: Git switch UX regresses even though backend semantics are unchanged. Mitigation: keep the same mutation path and test the icon button click/pending state.
- Risk: release validation misses hosted/npm behavior. Mitigation: run local browser acceptance before release and repeat against the newly published package.

## Verification Strategy

- Unit tests:
  - `pnpm --filter @openspecui/web test -- src/routes/git.test.tsx src/components/layout/area-nav.test.tsx src/components/layout/desktop-sidebar.test.tsx`
- Type/lint/build checks:
  - `pnpm --filter @openspecui/web typecheck`
  - Repository CI gates before PR/release: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`
- Browser acceptance:
  - Local dev/build browser walk for `/git` responsive worktree switch and desktop sidebar collapse/expand.
  - Post-release npm package browser walk using the newly published version.
