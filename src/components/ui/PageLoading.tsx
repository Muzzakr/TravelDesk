// Shaped loading placeholder for client-fetched detail/profile pages — these
// fetch after mount (via useEffect), so the route-level `loading.tsx`
// skeleton never covers them. Without this, `if (loading) return <p>...</p>`
// rendered a single unstyled line of gray text with no card or spinner,
// which on any real network latency reads as a blank page. Reuses the same
// bordered/pulsing card language as app/(dashboard)/loading.tsx.
export function PageLoading() {
  return (
    <div className="max-w-2xl space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded-lg bg-gray-200" />
      <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-3">
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="h-4 w-2/3 rounded bg-gray-200" />
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="h-4 w-1/2 rounded bg-gray-200" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-3">
        <div className="h-3 w-32 rounded bg-gray-100" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-100" />
      </div>
    </div>
  )
}
