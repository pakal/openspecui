---
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Promote deleted-worktree recovery into a platform-level handoff flow. The watcher runtime now reports project-root eviction state, the server resolves fallback worktrees from cached Git common-dir metadata, and the web shell auto-switches to an existing default-branch worktree while preserving the current route.
