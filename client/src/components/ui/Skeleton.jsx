export function Skeleton({ className = '' }) {
  return (
    <div className={`skeleton-pulse rounded-lg bg-white/[0.05] ${className}`} />
  )
}

export function SkeletonCard({ children }) {
  return (
    <div className="bg-card border border-white/[0.06] rounded-2xl p-5">
      {children}
    </div>
  )
}
