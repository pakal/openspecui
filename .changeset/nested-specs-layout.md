---
"@openspecui/core": patch
"@openspecui/server": patch
"@openspecui/web": patch
---

Support nested spec layouts (`openspec/specs/<topic>/<feature>.md`). Some OpenSpec
projects store several specs per topic as `<topic>/<feature>.md` files instead of the
canonical one-capability-per-directory `<capability>/spec.md` layout. The Specs tab now
enumerates, reads, writes, and deep-links both layouts: spec ids keep the slashed
`topic/feature` form, the adapter resolves each id to its real on-disk file (canonical
`spec.md` first, then a sibling `<feature>.md`), and the spec route accepts slashed ids via
a splat segment. Canonical single-directory specs continue to work unchanged.
