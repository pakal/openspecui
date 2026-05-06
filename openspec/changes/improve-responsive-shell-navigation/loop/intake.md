## User Input

- 改进一些前端：
  1. git 页面没有做好响应式的支持，底部的git worktree的switch这里太宽了。需要自动适应自动换行。并且switch按钮不用那么大，只需要做成一个icon-button即可
  2. 侧边栏需要提供一个收起展开的功能：把这个按钮放在顶部OPENSPEC这个logo的右侧。收起后，OPENSPEC这个LOGO隐藏起来，然后其它全部只留下icon即可（拖动的功能也隐藏起来）。
- Implement the plan.
- 完成 Git Worktree 响应式与侧边栏收起的任务，完成真实浏览器走查。并发布一个新版本，并使用新版本进行再次走查，确保符合预期
- worktree自适应的前提并不是牺牲内容，请你考虑一下卡片化。我让你把内容换行，不是把内容省略掉。

## Objective Scope

- Improve the live Git page "Other Worktrees" area so worktree summaries and switch actions adapt to narrow widths without horizontal overflow.
- Preserve full Git worktree branch/path content in responsive layouts; wrapping/cardification is preferred over truncation or omission.
- Replace the text-heavy worktree switch action with a compact accessible icon button while preserving existing backend handoff behavior.
- Add desktop sidebar collapse/expand behavior from the top logo row.
- In collapsed desktop sidebar mode, hide the OpenSpec logo, hide text labels, keep icon-only navigation/search controls accessible, and hide drag affordances/drag behavior.
- Update OpenSpec artifacts and release metadata required for the publishable web package behavior change.
- Complete local verification, real-browser acceptance, release a new version, and re-run acceptance against the newly published version.

## Non-Goals

- Do not change Git worktree switching backend semantics, stale worktree handling, child instance handoff, or recovery routing.
- Do not redesign the mobile header/tab bar.
- Do not change nav tab placement/persistence rules beyond the sidebar collapsed presentation preference.
- Do not include the unrelated `upgrade-vite-8` active change in this loop.

## Acceptance Boundary

- The Git page worktree switch action is icon-only and remains accessible by name/tooltip.
- The Git page "Other Worktrees" area wraps/adapts at narrow widths without horizontal overflow and without omitting branch/path content.
- The desktop sidebar can collapse and expand from the logo row.
- Collapsed desktop sidebar hides the logo and all nav/search labels while preserving icons and accessible labels.
- Collapsed desktop sidebar hides drag handles and disables drag/drop navigation interactions.
- Relevant unit/type/browser checks pass or any unrelated known failures are explicitly separated with evidence.
- A real browser walk confirms the local implementation behavior.
- A new package version is released through the repository release workflow.
- The same behavior is validated again using the newly published package version.
