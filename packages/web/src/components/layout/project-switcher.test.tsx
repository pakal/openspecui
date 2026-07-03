import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProjectSwitcher } from './project-switcher'

const { overviewQueryMock, switchProjectMock, navigateMock, staticModeMock } = vi.hoisted(() => ({
  overviewQueryMock: vi.fn(),
  switchProjectMock: vi.fn(),
  navigateMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('@/lib/server-handoff', () => ({
  navigateToServerHandoff: navigateMock,
}))

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

// Replace the Base UI Select with a native <select> so options + disabled state are
// assertable without portal/pointer plumbing (mirrors routes/git.test.tsx).
vi.mock('@/components/select', () => ({
  Select: ({
    value,
    options = [],
    onValueChange,
    ariaLabel,
    disabled,
    'data-testid': dataTestId,
  }: {
    value: string
    options?: readonly { value: string; label: ReactNode; disabled?: boolean }[]
    onValueChange: (value: string) => void
    ariaLabel?: string
    disabled?: boolean
    'data-testid'?: string
  }) => (
    <select
      aria-label={ariaLabel}
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

// Keep the real singleton queryClient (so useQuery works without a provider) but
// override trpcClient with our procedure mocks.
vi.mock('@/lib/trpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/trpc')>()
  return {
    ...actual,
    trpcClient: {
      projects: {
        overview: { query: overviewQueryMock },
        switchProject: { mutate: switchProjectMock },
      },
    },
  }
})

import { queryClient } from '@/lib/trpc'

const PARENT_OVERVIEW = {
  parentMode: true,
  parentRoot: '/root',
  currentProjectPath: '/root/alpha',
  currentProjectName: 'alpha',
  projects: [
    { name: 'alpha', path: '/root/alpha', hasOpenspec: true },
    { name: 'bravo', path: '/root/bravo', hasOpenspec: true },
    { name: 'charlie', path: '/root/charlie', hasOpenspec: false },
  ],
}

function optionByText(name: string): HTMLOptionElement {
  return screen.getByRole('option', { name }) as HTMLOptionElement
}

describe('ProjectSwitcher', () => {
  beforeEach(() => {
    queryClient.clear()
    staticModeMock.mockReturnValue(false)
    overviewQueryMock.mockResolvedValue(PARENT_OVERVIEW)
    switchProjectMock.mockResolvedValue({ serverUrl: 'http://127.0.0.1:3200' })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists only openspec-bearing projects by default and hides empty folders', async () => {
    render(<ProjectSwitcher fallback={<span>fallback</span>} />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Switch project' })).toBeTruthy()
    })

    expect(optionByText('alpha')).toBeTruthy()
    expect(optionByText('bravo')).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'charlie' })).toBeNull()

    // Reveal control advertises the number of hidden non-project folders.
    expect(
      screen.getByRole('button', { name: 'Show 1 folder without openspec/' })
    ).toBeTruthy()
  })

  it('reveals empty folders as disabled options when toggled', async () => {
    render(<ProjectSwitcher fallback={<span>fallback</span>} />)

    const revealButton = await screen.findByRole('button', {
      name: 'Show 1 folder without openspec/',
    })
    fireEvent.click(revealButton)

    const charlie = optionByText('charlie')
    expect(charlie).toBeTruthy()
    expect(charlie.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Hide folders without openspec/' })).toBeTruthy()
  })

  it('switches project on selection then hands off to its server', async () => {
    render(<ProjectSwitcher fallback={<span>fallback</span>} />)

    const select = (await screen.findByRole('combobox', {
      name: 'Switch project',
    })) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '/root/bravo' } })

    await waitFor(() => {
      expect(switchProjectMock).toHaveBeenCalledWith({ path: '/root/bravo' })
    })
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        handoff: { serverUrl: 'http://127.0.0.1:3200' },
        location: window.location,
      })
    })
  })

  it('renders the fallback in single-project mode', async () => {
    overviewQueryMock.mockResolvedValue({
      parentMode: false,
      parentRoot: null,
      currentProjectPath: '/root/alpha',
      currentProjectName: 'alpha',
      projects: [{ name: 'alpha', path: '/root/alpha', hasOpenspec: true }],
    })

    render(<ProjectSwitcher fallback={<span>fallback</span>} />)

    await waitFor(() => {
      expect(screen.getByText('fallback')).toBeTruthy()
    })
    expect(screen.queryByRole('combobox', { name: 'Switch project' })).toBeNull()
  })

  it('renders the fallback in static mode without querying', () => {
    staticModeMock.mockReturnValue(true)

    render(<ProjectSwitcher fallback={<span>fallback</span>} />)

    expect(screen.getByText('fallback')).toBeTruthy()
    expect(overviewQueryMock).not.toHaveBeenCalled()
  })
})
