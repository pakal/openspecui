## User Input

> I want that if the main folder of openspecui doesn't contain an `openspec/` subfolder, the app treats the children of this main project folder as real project folders, via a top-bar dropdown selector, and so we can switch from one openspec folder to the other via this selector, from the same openspecui instance. Subfolders without an `openspec/` folder shall be hidden from this selector by default.

## Objective Scope

- **Parent-mode detection**: when `openspecui` is launched against a directory whose own `openspec/` subfolder is absent, the app enters "parent mode" instead of showing the current "no openspec/ found" empty-state.
- **Child project discovery**: in parent mode, the app scans the launched directory's **immediate** children. A child qualifies as a switchable project when it contains an `openspec/` subfolder.
- **Top-bar project selector**: parent mode renders a dropdown in the top bar listing the discovered child projects. It reflects which project is currently active.
- **Runtime switching**: selecting a different project from the dropdown re-points the running server at that project's `openspec/` directory and refreshes all project-scoped views — **without restarting the `openspecui` process**. Reactivity (file-watch driven updates) must keep working for the newly selected project.
- **Hidden empties**: children that do **not** contain an `openspec/` subfolder are excluded from the selector by default (the phrase "by default" is honored — a reveal affordance is allowed but its selection/init behavior is a non-goal for this loop; see below).
- **Default active project**: on launch in parent mode, one discovered child is active by default (deterministic order, e.g. first by name).

## Non-Goals

- **No change to single-project mode**: when the launched directory *does* contain its own `openspec/`, existing behavior is unchanged — no parent scan, no forced dropdown. (A single-entry selector is acceptable but not required.)
- **No recursive discovery**: only the launched directory's direct children are scanned; nested/grandchild `openspec/` folders are not searched.
- **No simultaneous multi-project view**: exactly one project is active at a time.
- **No initialization of empty children**: revealing/hiding empty subfolders is in scope, but *initializing* an `openspec/` in a child that lacks one (or otherwise acting on a non-project child) is out of scope for this loop.
- **No persistence of the selected project across process restarts** (default selection is recomputed on each launch).
- **No behavior change to the OpenSpec CLI runner resolution** (already handled by a prior change).

## Acceptance Boundary

1. **Parent mode activates**: launching `openspecui <parent>` where `<parent>/openspec/` is absent, `<parent>/A/openspec/` and `<parent>/B/openspec/` exist, and `<parent>/C/` has no `openspec/`, loads the app without the "openspec/ not found" empty-state; the top bar shows a project dropdown listing exactly `A` and `B`; one of them is active by default.
2. **`C` is hidden**: the child `C` (no `openspec/`) does not appear in the selector by default.
3. **Runtime switch works**: with `A` active, selecting `B` from the dropdown switches the changes list, specs, and statuses to `B`'s data **without a server restart**, and subsequent on-disk edits under `B/openspec/` are reflected live (reactivity intact). Switching back to `A` restores `A`'s data.
4. **Single-project regression-free**: launching `openspecui <proj>` where `<proj>/openspec/` exists behaves exactly as before this change (no empty-state, project data loads; dropdown, if shown, lists only `<proj>`).
5. **No stale cross-project bleed**: after switching from `A` to `B`, no `A`-scoped data (changes, statuses, watchers) remains visible or continues to drive updates.
