'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  // Build windowed page list: always show first, last, current ±1, with ellipsis
  const pages: (number | '...')[] = []
  const delta = 1
  const range = {
    start: Math.max(2, page - delta),
    end: Math.min(totalPages - 1, page + delta),
  }

  pages.push(1)
  if (range.start > 2) pages.push('...')
  for (let i = range.start; i <= range.end; i++) pages.push(i)
  if (range.end < totalPages - 1) pages.push('...')
  if (totalPages > 1) pages.push(totalPages)

  const btnBase = 'rounded px-2.5 py-1 text-xs font-medium transition-colors'
  const btnActive = 'bg-indigo-600 text-white'
  const btnIdle = 'text-gray-500 hover:bg-gray-100'

  return (
    <div className="flex items-center gap-1">
      {/* Prev */}
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40"
      >‹</button>

      {/* Mobile: "X / Y" */}
      <span className="sm:hidden text-xs text-gray-500 px-2">{page} / {totalPages}</span>

      {/* Desktop: windowed numbered buttons */}
      <div className="hidden sm:flex items-center gap-1">
        {pages.map((n, i) =>
          n === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">…</span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n as number)}
              className={`${btnBase} ${n === page ? btnActive : btnIdle}`}
            >
              {n}
            </button>
          )
        )}
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40"
      >›</button>
    </div>
  )
}
