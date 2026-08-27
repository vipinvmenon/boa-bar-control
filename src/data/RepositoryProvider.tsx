/* eslint-disable react-refresh/only-export-components */
/**
 * BAR-042 — repository selection and access.
 *
 * The implementation is chosen ONCE, here, at bootstrap. A screen asks for data
 * and does not know or care which implementation answers. Critically, the
 * fixture repository can never be reached as a fallback from a failed live load:
 * that path is what rendered fixture stock as live festival inventory (BAR-067),
 * and there is no code path here that can produce it.
 *
 * Uses React Query, which was installed and wired to nothing (an audit finding).
 * It gives loading and error states without every screen hand-rolling them.
 */
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createFixtureRepository, type FixtureVariant } from './fixture/fixture-repository'
import type { Repository } from './repository'

const RepositoryContext = createContext<Repository | null>(null)

/**
 * The two-state fidelity gate (BAR-008) drives this with `?fixture=b`. Disabled
 * in production builds so it cannot be used against a real deployment.
 */
function requestedVariant(): FixtureVariant {
  if (import.meta.env.PROD) return 'a'
  if (typeof window === 'undefined') return 'a'
  return new URLSearchParams(window.location.search).get('fixture') === 'b' ? 'b' : 'a'
}

export function RepositoryProvider({ children }: PropsWithChildren) {
  // TODO(BAR-042): select the live repository when Supabase is configured AND a
  // membership has loaded. Until that exists this is fixture-only, and the app
  // says so loudly in the shell rather than implying it is live (BAR-139).
  const repository = useMemo(() => createFixtureRepository(requestedVariant()), [])
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
}

export function useRepository(): Repository {
  const repository = useContext(RepositoryContext)
  if (!repository) {
    throw new Error('useRepository must be used inside RepositoryProvider')
  }
  return repository
}

/**
 * Read a value from the repository.
 *
 * `key` must include everything the query depends on, so switching fixture
 * variant or filter refetches rather than serving a stale cache.
 */
export function useRepositoryQuery<T>(
  key: readonly unknown[],
  read: (repository: Repository) => Promise<T>,
): UseQueryResult<T> {
  const repository = useRepository()
  return useQuery({
    queryKey: [repository.kind, requestedVariant(), ...key],
    queryFn: () => read(repository),
    staleTime: 30_000,
  })
}
