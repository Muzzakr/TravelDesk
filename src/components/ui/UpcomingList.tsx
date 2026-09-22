import Link from 'next/link'
import { Plane, Calendar } from 'lucide-react'
import type { UpcomingItem } from '@/lib/upcoming'

function formatRelative(date: Date): string {
  const days = Math.round((date.getTime() - Date.now()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

/** Renders a `getUpcoming()` result as a row list — icon + title/subtitle + relative date. */
export function UpcomingList({ items, hrefFor }: { items: UpcomingItem[]; hrefFor: (item: UpcomingItem) => string }) {
  if (items.length === 0) {
    return <p className="px-5 py-4 text-xs text-gray-400">Nothing in the next 30 days.</p>
  }
  return (
    <div className="divide-y divide-gray-50">
      {items.map((item) => (
        <Link key={`${item.type}-${item.id}`} href={hrefFor(item)}
          className="px-5 py-2.5 flex items-center gap-3 hover:bg-gray-50">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'trip' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
            {item.type === 'trip' ? <Plane className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-900 truncate">{item.title}</p>
            <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
          </div>
          <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{formatRelative(item.date)}</span>
        </Link>
      ))}
    </div>
  )
}
