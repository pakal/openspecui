## Research Findings

- `CLAUDE.md` defines README versioning by OpenSpec CLI version, not by OpenSpecUI package version.
- Current docs state `openspecui @latest/@^2` requires OpenSpec CLI `>=1.2.0 <2`, but the manager clarified the stricter project law:
  - `openspecui@2.*` maps to `openspec@1.2.*`.
  - `openspecui@3.*` maps to `openspec@1.3.*`.
  - Compatibility is backward from 3.x to 1.2.x, not forward from 2.x to 1.3.x.
- Current code has hardcoded 1.2 references in:
  - Web CLI health gate.
  - Settings profile/sync copy.
  - Server comments and profile state APIs.
  - Main README files.
  - OpenSpec specs.
  - `scripts/check-openspec-reference.mjs`.
- OpenSpec CLI 1.3.1 adds or changes:
  - New tools: `bob`, `forgecode`, `junie`, `lingma`.
  - `AIToolOption.detectionPaths` for precise GitHub Copilot auto-detection.
  - OpenCode command directory moves from `.opencode/command/` to `.opencode/commands/`.
  - Clean `--json` output and path/telemetry fixes.
- Current `references/openspec` is pinned around `v1.2.0` and lacks local 1.3 tags until fetched.

## Decision & Plan (Approved)

- Treat this as the implementation basis for OpenSpecUI 3.x, not as an OpenSpecUI 2.x patch.
- Add a shared compatibility law module with:
  - target CLI series: `1.3`.
  - accepted runtime range: `>=1.2.0 <1.4.0`.
  - recommended/current range: `>=1.3.0 <1.4.0`.
  - legacy-compatible range: `>=1.2.0 <1.3.0`.
- Update runtime UI so 1.2.x is accepted with an upgrade recommendation, 1.3.x is current, and unsupported versions are blocked.
- Sync tool metadata to OpenSpec CLI 1.3.1 and model primary versus legacy command paths instead of adding local special-case glue.
- Archive 1.2 README content and make root README describe OpenSpecUI 3.x / OpenSpec CLI 1.3.x with 1.2 backward compatibility.
- Update the reference submodule and reference check to `v1.3.*`.

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI 3.x can run against OpenSpec CLI 1.3.x as the current line and 1.2.x as legacy-compatible.
- Settings/init tooling can see and repair OpenSpec CLI 1.3.x provider artifacts.
- Copilot detection becomes path-based instead of treating any `.github/` directory as Copilot.

### Modified Behavior

- OpenCode command artifacts prefer `.opencode/commands/` while recognizing `.opencode/command/` as legacy-compatible.
- Documentation and specs no longer describe a wide `>=1.2.0 <2` OpenSpec CLI range for OpenSpecUI 2.x.
- The reference check now enforces the 1.3 reference line.

## Risks and Mitigations

- Risk: Accepting 1.2.x in 3.x could be mistaken for 2.x forward compatibility.
  - Mitigation: copy and compatibility labels explicitly state 1.2 is legacy-compatible under 3.x only.
- Risk: OpenCode legacy command paths could be reported as stale errors.
  - Mitigation: represent legacy command artifacts explicitly in tool init state.
- Risk: Browser package could import the core root entry at runtime.
  - Mitigation: expose compatibility helpers through a safe subpath export.

## Verification Strategy

- Add unit tests for compatibility classification.
- Add unit tests for 1.3 tool metadata, Copilot detection paths, and OpenCode primary/legacy command state.
- Add web tests for CLI health gate behavior across 1.1.x, 1.2.x, 1.3.x, and 1.4.x.
- Run targeted core/server/web tests first; run broader CI-equivalent checks if time permits.
