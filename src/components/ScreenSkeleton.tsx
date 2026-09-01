type ScreenSkeletonVariant = 'section' | 'flow' | 'bars' | 'bar' | 'count'

type ScreenSkeletonProps = {
  variant?: ScreenSkeletonVariant
}

/** A content-shaped loading state that keeps the screen's rhythm intact. */
export function ScreenSkeleton({ variant = 'section' }: ScreenSkeletonProps) {
  return (
    <div className={`screen-skeleton screen-skeleton-${variant}`} role="status" aria-label="Loading">
      <div className="skeleton-head"><i /><i /></div>
      <div className="skeleton-card"><i /><i /><i /></div>
      <div className="skeleton-grid"><i /><i /><i /></div>
      <div className="skeleton-list"><i /><i /><i /><i /></div>
    </div>
  )
}
