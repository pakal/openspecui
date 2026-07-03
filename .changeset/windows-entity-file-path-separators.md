---
'@openspecui/core': patch
---

Normalize entity file paths to forward slashes on Windows. The archive/change
entity reader derived each `ChangeFile.path` by slicing the native absolute
path, which keeps the platform separator (`\` on Windows). That leaked into the
detail payload, so artifact grouping and file lookups that expect
posix-separated paths (the documented contract) silently failed on Windows.
Paths are now normalized via `normalizeOpsxEntityPath` at read time.
