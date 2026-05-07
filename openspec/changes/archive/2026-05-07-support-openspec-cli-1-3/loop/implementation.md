## Implementation State

- OpenSpec change scaffold created for `support-openspec-cli-1-3`.
- Intake and research plan capture the manager-approved version law.
- Added shared OpenSpec CLI compatibility law under `@openspecui/core/openspec-compat`.
- Updated CLI health UI to treat 1.3.x as current, 1.2.x as legacy-compatible, and versions outside `>=1.2.0 <1.4.0` as blocked.
- Updated apply-instructions parsing so OpenSpec CLI 1.3 `contextFiles` arrays are the internal law while legacy single-path values normalize to arrays.
- Synced tool metadata with OpenSpec CLI 1.3.1, including Bob Shell, ForgeCode, Junie, Lingma, Copilot detection paths, and OpenCode primary `.opencode/commands/` plus legacy `.opencode/command/`.
- Archived current 1.2 README files and rewrote root README files for the 3.x / 1.3.x line.
- Updated main OpenSpec specs with the approved version law.
- Updated `references/openspec` to `v1.3.1` and reference check to enforce `v1.3.*`.
- Added a major changeset for the publishable packages affected by the 3.0 alignment.
- Local verification passed:
  - `pnpm openspec:check-reference`
  - `pnpm --filter @openspecui/core test -- openspec-compat.test.ts tool-config.test.ts tool-init-state.test.ts`
  - `pnpm --filter @openspecui/core test -- opsx-types.test.ts openspec-compat.test.ts`
  - `pnpm --filter @openspecui/core typecheck`
  - parsed real `agenter` OpenSpec CLI 1.3.1 `instructions apply --json` output through `ApplyInstructionsSchema`
  - smoke-started `pnpm openspecui --dir /Users/kzf/Dev/GitHub/jixoai-labs/agenter --no-open --port 3910` without the prior kernel warmup failure
  - `pnpm --filter @openspecui/web test -- src/components/cli-health-gate.test.tsx src/routes/settings-init.test.ts`
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Use a shared compatibility law module as the platform rule for CLI version classification.
- Keep OpenSpec CLI 1.2.x as backward-compatible for OpenSpecUI 3.x.
- Do not make OpenSpecUI 2.x forward-compatible with OpenSpec CLI 1.3.x.
- Treat OpenCode `.opencode/commands/` as the primary 1.3 path and `.opencode/command/` as legacy-compatible.

## Divergence Notes

- The final implementation keeps 1.2.x as a non-blocking legacy-compatible runtime for OpenSpecUI 3.x, but the docs and reference line are anchored on OpenSpec CLI 1.3.x.
- OpenCode legacy command paths count as initialized for compatibility, while surfacing `legacyCommandWorkflows` for UI/status awareness.

## Loopback Triggers

- If OpenSpec CLI 1.3.1 source metadata differs from the investigated release notes, return to research-plan and update the tool model before continuing.
- If 1.2.x compatibility requires behavior beyond path/tool detection, return to research-plan and record the additional runtime compatibility rule.
- If CI reference check cannot enforce `v1.3.*` without broader submodule workflow changes, return to research-plan before modifying CI behavior.
