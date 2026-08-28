/* eslint-disable react-refresh/only-export-components */
/**
 * BAR-042 — repository selection and access.
 *
 * The implementation is chosen ONCE, here, at bootstrap. A screen asks for data
 * and does not know or care which implementation answers. Critically, the
 * fixture repository can never be reached as a fallback from a failed live load:
 * that path is what rendered fixture stock as live festival inventory (BAR-067),
 * and there is no code path here that can produce it. A live read that fails
 * throws, and the screen shows an error.
 *
 * Uses React Query, which was installed and wired to nothing (an audit finding).
 * It gives loading and error states without every screen hand-rolling them.
 */
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createFixtureRepository, type FixtureVariant } from './fixture/fixture-repository'
import { createLiveRepository } from './live/live-repository'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
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
  const { user, activeMembership } = useAuth()

  /**
   * Live requires all three: a configured client, a signed-in user, and a loaded
   * membership. A membership is what names the venue, and without it there is no
   * venue to read — so this is not a preference but a precondition. Until they
   * are all present the fixture repository serves and the shell says DEMO DATA ·
   * NOT LIVE on every screen (BAR-139); a production build with no configuration
   * refuses to start at all rather than reaching this point.
   */
  const repository = useMemo<Repository>(() => {
    if (isSupabaseConfigured && user && activeMembership) {
      return createLiveRepository({
        venueId: activeMembership.venueId,
        userId: user.id,
        timezone: activeMembership.venueTimezone,
        role: activeMembership.role,
        locationId: activeMembership.locationId ?? null,
      })
    }
    return createFixtureRepository(requestedVariant())
  }, [user, activeMembership])

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
 * variant or filter refetches rather than serving a stale cache. `repository.kind`
 * is part of the key so that signing in cannot leave a fixture figure on screen.
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
    /**
     * BAR-047. A failed read is raised to the route's error boundary instead of
     * being handed back as `data === undefined`.
     *
     * Every screen renders `query.data?.field ?? '—'`, so before this a live read
     * that failed produced a screen of em-dashes and zeroes — visually identical
     * to a venue with no stock. On this project that is the whole problem: a
     * warehouse showing 0 because the network dropped, and a warehouse showing 0
     * because it is empty, must not look the same. The live repository already
     * refuses to invent a figure; this makes the refusal visible.
     *
     * Retries are still 1 (from the QueryClient default), so a single blip does
     * not surface at all.
     */
    throwOnError: true,
  })
}
