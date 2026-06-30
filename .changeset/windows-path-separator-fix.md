---
"@openspecui/core": patch
"@openspecui/server": patch
---

Fix Windows path handling so projects load and stay reactive. Path-containment
checks hardcoded the POSIX `/` separator, so on Windows (where filesystem paths
use `\`) the watcher dropped every change event (no live updates), entity file
reads threw "Resolved path escaped entity root", and file previews returned
empty. These now use a separator-agnostic `isPathInsideOrEqual` helper.
