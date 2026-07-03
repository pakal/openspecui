---
"@openspecui/core": minor
"@openspecui/server": minor
"@openspecui/web": minor
"openspecui": minor
---

Add a top-bar project switcher for multi-project launch directories.

When `openspecui` is launched against a directory that has no `openspec/` folder of
its own, its immediate subfolders are now treated as candidate projects. The launched
server binds the first `openspec/`-bearing child by default and exposes a top-bar
dropdown (desktop sidebar + mobile header) to switch between the sibling projects from
a single instance. Selecting a project hands off to that project's own server (full
reload), keeping per-project isolation.

Subfolders without an `openspec/` directory are hidden from the selector by default and
revealed as disabled entries via a toggle. When no subfolder is an OpenSpec project, a
clear "No OpenSpec projects found under &lt;root&gt;" gate replaces the generic empty view.
Single-project launches are unchanged.
