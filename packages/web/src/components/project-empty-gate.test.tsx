import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProjectEmptyGate } from './project-empty-gate'

const { overviewQueryMock, staticModeMock } = vi.hoisted(() => ({
  overviewQueryMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

// Keep the real singleton queryClient (so useQuery works without a provider) but
// override trpcClient with the overview mock.
vi.mock('@/lib/trpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/trpc')>()
  return {
    ...actual,
    trpcClient: {
      projects: {
        overview: { query: overviewQueryMock },
      },
    },
  }
})

import { queryClient } from '@/lib/trpc'

describe('ProjectEmptyGate', () => {
  beforeEach(() => {
    queryClient.clear()
    staticModeMock.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows the no-projects message naming the scanned root when zero children have openspec', async () => {
    overviewQueryMock.mockResolvedValue({
      parentMode: true,
      parentRoot: '/root',
      currentProjectPath: '/root',
      currentProjectName: 'root',
      projects: [
        { name: 'alpha', path: '/root/alpha', hasOpenspec: false },
        { name: 'bravo', path: '/root/bravo', hasOpenspec: false },
      ],
    })

    render(<ProjectEmptyGate />)

    await waitFor(() => {
      expect(screen.getByText('No OpenSpec projects found')).toBeTruthy()
    })
    expect(screen.getByText('/root')).toBeTruthy()
    // Skipped folders are listed as context.
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('bravo')).toBeTruthy()
  })

  it('renders nothing when at least one child has openspec', async () => {
    overviewQueryMock.mockResolvedValue({
      parentMode: true,
      parentRoot: '/root',
      currentProjectPath: '/root/alpha',
      currentProjectName: 'alpha',
      projects: [
        { name: 'alpha', path: '/root/alpha', hasOpenspec: true },
        { name: 'bravo', path: '/root/bravo', hasOpenspec: false },
      ],
    })

    const { container } = render(<ProjectEmptyGate />)

    // Give the query a tick to resolve, then assert nothing rendered.
    await waitFor(() => {
      expect(overviewQueryMock).toHaveBeenCalled()
    })
    await Promise.resolve()
    expect(container.textContent).toBe('')
  })

  it('renders nothing in single-project mode', async () => {
    overviewQueryMock.mockResolvedValue({
      parentMode: false,
      parentRoot: null,
      currentProjectPath: '/root/alpha',
      currentProjectName: 'alpha',
      projects: [{ name: 'alpha', path: '/root/alpha', hasOpenspec: true }],
    })

    const { container } = render(<ProjectEmptyGate />)

    await waitFor(() => {
      expect(overviewQueryMock).toHaveBeenCalled()
    })
    expect(container.textContent).toBe('')
  })

  it('renders nothing in static mode without querying', () => {
    staticModeMock.mockReturnValue(true)

    const { container } = render(<ProjectEmptyGate />)

    expect(container.textContent).toBe('')
    expect(overviewQueryMock).not.toHaveBeenCalled()
  })
})
