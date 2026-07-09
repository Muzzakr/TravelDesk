'use client'

/**
 * Shown instead of a list when the initial fetch fails — a silent failure
 * otherwise looks identical to "no data", which is misleading on flaky
 * mobile networks.
 */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
      <p className="text-sm font-medium text-red-700">Something went wrong loading the data.</p>
      <p className="mt-1 text-xs text-red-500">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-[44px] rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
