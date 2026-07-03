---
"@openspecui/core": patch
---

Fix OpenSpec CLI runner auto-detection on Windows and surface real CLI errors.

On Windows/nvm the resolved `openspec` executable is an npm shim that
`spawn(..., { shell: false })` cannot launch, so every runner candidate failed
with `ENOENT` and the UI demanded a manual `node <bin>/openspec.js` path. Runner
resolution now derives a directly-spawnable `node <package>/bin/openspec.js`
command from the shim location and probes it first.

The change-detail page also showed an opaque `openspec status failed (exit 1)`.
openspec reports structured errors as a JSON envelope on STDOUT while exiting
non-zero; those messages are now surfaced instead of the bare exit code. In
addition, a single invalid change (e.g. a stale bookmark or an unsupported change
name) no longer poisons warmup or the whole status list — such changes are
excluded and logged rather than rejecting every change.
