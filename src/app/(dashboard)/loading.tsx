// Route-level Suspense fallback for every dashboard page — gives instant
// feedback on navigation instead of a frozen previous page on slow networks.
export default function DashboardLoading() {
  return (
    <div className="max-w-7xl space-y-6 animate-pulse" aria-busy="true" aria-label="Loading page">
      {/* Title */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="h-4 w-72 rounded bg-gray-100" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-100 bg-white p-4">
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="mt-3 h-6 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-4 py-4 last:border-0">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gray-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-3.5 w-14 shrink-0 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
