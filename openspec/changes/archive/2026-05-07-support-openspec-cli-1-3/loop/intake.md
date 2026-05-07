## User Input

- User requirement: "不论1.3是不是破坏性更新，我们必须准信严格的变更同步规范，openspecui@2._ 对应的就是 openspec@1.2._，所以 openspec@1.3._必须对应的是 openspecui@3._ 。"
- User requirement: "2._不用兼容1.3，反过来我们的规范是运行 3._ 兼容 1.2。"
- User request: implement the approved plan for OpenSpecUI 3.x alignment with OpenSpec CLI 1.3.x.

## Objective Scope

- Promote the OpenSpec CLI 1.3.x alignment into an OpenSpecUI 3.x major-release track.
- Encode the version law in shared implementation, docs, specs, and reference checks:
  - `openspecui@2.*` corresponds to `openspec@1.2.*`.
  - `openspecui@3.*` corresponds to `openspec@1.3.*`.
  - `openspecui@2.*` does not forward-support `openspec@1.3.*`.
  - `openspecui@3.*` backward-supports `openspec@1.2.*`.
- Sync OpenSpec CLI 1.3.x tool metadata, detection behavior, and command artifact paths.
- Add release-impacting changeset coverage for publishable package changes.

## Non-Goals

- Do not retrofit OpenSpec CLI 1.3.x support into `openspecui@2.*`.
- Do not run the release versioning workflow or publish packages in this implementation pass.
- Do not archive unrelated active change `upgrade-vite-8`.
- Do not redesign unrelated Git, dashboard, hosted app, or static export behavior.

## Acceptance Boundary

- Shared compatibility code classifies OpenSpec CLI versions according to the approved law.
- UI/server/core behavior accepts OpenSpec CLI 1.2.x and 1.3.x for OpenSpecUI 3.x, recommends 1.3.x, and blocks outside the accepted range.
- Tool detection and init state reflect OpenSpec CLI 1.3.1 tool metadata while preserving 1.2 legacy artifacts where required.
- README and specs describe the 3.x/1.3.x line and archive the 2.x/1.2.x README.
- `references/openspec` is updated to OpenSpec CLI 1.3.x and CI reference check enforces `v1.3.*`.
- Targeted tests pass and a major changeset is present.
