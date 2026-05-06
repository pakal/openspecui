import type { GitWorktreeSummary } from '@openspecui/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorktreeCard } from './git-worktree-card'

describe('WorktreeCard', () => {
  it('preserves long worktree content for wrapping instead of truncating it', () => {
    const longPath =
      '/Users/kzf/Dev/GitHub/jixoai-labs/openspecui-feature-with-a-very-long-worktree-path'
    const worktree: GitWorktreeSummary = {
      path: longPath,
      relativePath: '../openspecui-feature-with-a-very-long-worktree-path',
      pathAvailable: true,
      branchName: 'feature/responsive-shell-navigation-with-long-branch-name',
      detached: false,
      isCurrent: false,
      ahead: 2,
      behind: 1,
      diff: { files: 3, insertions: 12, deletions: 4 },
    }

    render(
      <WorktreeCard
        worktree={worktree}
        emphasize={false}
        action={
          <button type="button" aria-label={`Switch to ${worktree.branchName}`}>
            switch
          </button>
        }
      />
    )

    const branchText = screen.getByText(worktree.branchName)
    const pathText = screen.getByText(longPath)

    expect(branchText.className).toContain('break-words')
    expect(branchText.className).not.toContain('truncate')
    expect(pathText.className).toContain('break-all')
    expect(pathText.className).not.toContain('truncate')
    expect(screen.getByRole('button', { name: `Switch to ${worktree.branchName}` })).toBeTruthy()
  })
})
