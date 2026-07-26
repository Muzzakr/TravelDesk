'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EVENT_STATUS_BADGE, EVENT_STATUS_DOT, EVENT_STATUS_CHIP, type EventRow } from './types'
import { startOfMonth, addMonths, startOfWeek, addDays, isSameDay, dayKey, monthGridDays, weekDays } from './date-utils'

type View = 'month' | 'week' | 'day'

interface EventsCalendarProps {
  events: EventRow[]
  onSelect: (event: EventRow) => void
}

export function EventsCalendar({ events, onSelect }: EventsCalendarProps) {
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [overflowDay, setOverflowDay] = useState<Date | null>(null)
  const today = useMemo(() => new Date(), [])

  const byDay = useMemo(() => {
    const map = new Map<string, EventRow[]>()
    for (const ev of events) {
      if (!ev.eventDate) continue
      const key = dayKey(new Date(ev.eventDate))
      const list = map.get(key)
      if (list) list.push(ev)
      else map.set(key, [ev])
    }
    for (const list of map.values()) list.sort((a, b) => a.eventCode.localeCompare(b.eventCode))
    return map
  }, [events])

  function go(delta: number) {
    if (view === 'month') setCursor((c) => addMonths(c, delta))
    else if (view === 'week') setCursor((c) => addDays(c, delta * 7))
    else setCursor((c) => addDays(c, delta))
  }

  const periodLabel = useMemo(() => {
    if (view === 'month') return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const start = startOfWeek(cursor)
      const end = addDays(start, 6)
      const sameMonth = start.getMonth() === end.getMonth()
      const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const endLabel = end.toLocaleDateString(
        'en-US',
        sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
      )
      return `${startLabel} – ${endLabel}`
    }
    return cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }, [view, cursor])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Previous period"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next period"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCursor(new Date())}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Today
          </button>
          <h2 className="ml-1 text-sm font-semibold text-gray-900 sm:text-base">{periodLabel}</h2>
        </div>
        <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <MonthGrid cursor={cursor} today={today} byDay={byDay} onSelect={onSelect} onOverflow={setOverflowDay} />
      )}
      {view === 'week' && (
        <AgendaRange days={weekDays(startOfWeek(cursor))} today={today} byDay={byDay} onSelect={onSelect} />
      )}
      {view === 'day' && <AgendaRange days={[cursor]} today={today} byDay={byDay} onSelect={onSelect} />}

      {overflowDay && (
        <Modal
          open
          onClose={() => setOverflowDay(null)}
          title={overflowDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        >
          <div className="space-y-2">
            {(byDay.get(dayKey(overflowDay)) ?? []).map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={() => { setOverflowDay(null); onSelect(ev) }} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function MonthGrid({
  cursor, today, byDay, onSelect, onOverflow,
}: {
  cursor: Date
  today: Date
  byDay: Map<string, EventRow[]>
  onSelect: (e: EventRow) => void
  onOverflow: (d: Date) => void
}) {
  const monthStart = startOfMonth(cursor)
  const days = monthGridDays(monthStart)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-[10px] font-medium uppercase text-gray-500 sm:text-xs">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-1 py-2 text-center sm:px-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === monthStart.getMonth()
          const isToday = isSameDay(day, today)
          const dayEvents = byDay.get(dayKey(day)) ?? []

          return (
            <div
              key={dayKey(day)}
              className={`min-h-[68px] border-b border-r border-gray-100 p-1 last:border-r-0 sm:min-h-[104px] sm:p-1.5 ${
                inMonth ? 'bg-white' : 'bg-gray-50/50'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium sm:h-6 sm:w-6 sm:text-xs ${
                  isToday ? 'bg-indigo-600 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}
              >
                {day.getDate()}
              </span>

              {/* Mobile: 1 chip max */}
              <div className="mt-0.5 space-y-0.5 sm:hidden">
                {dayEvents.slice(0, 1).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
                ))}
                {dayEvents.length > 1 && (
                  <button type="button" onClick={() => onOverflow(day)}
                    className="block w-full truncate rounded px-1 text-left text-[10px] font-medium text-indigo-600 hover:underline">
                    +{dayEvents.length - 1} more
                  </button>
                )}
              </div>

              {/* Desktop: 3 chips max */}
              <div className="mt-0.5 hidden space-y-0.5 sm:block">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
                ))}
                {dayEvents.length > 3 && (
                  <button type="button" onClick={() => onOverflow(day)}
                    className="block w-full truncate rounded px-1 text-left text-xs font-medium text-indigo-600 hover:underline">
                    +{dayEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgendaRange({
  days, today, byDay, onSelect,
}: {
  days: Date[]
  today: Date
  byDay: Map<string, EventRow[]>
  onSelect: (e: EventRow) => void
}) {
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayEvents = byDay.get(dayKey(day)) ?? []
        const isToday = isSameDay(day, today)
        return (
          <div key={dayKey(day)} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className={`flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 ${isToday ? 'bg-indigo-50' : 'bg-gray-50'}`}>
              <span className={`text-sm font-semibold ${isToday ? 'text-indigo-700' : 'text-gray-800'}`}>
                {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              {isToday && <Badge variant="blue">Today</Badge>}
              <span className="ml-auto text-xs text-gray-400">
                {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-2 p-3">
              {dayEvents.length === 0 ? (
                <p className="py-2 text-center text-xs text-gray-400">No events</p>
              ) : (
                dayEvents.map((ev) => <EventCard key={ev.id} event={ev} onClick={() => onSelect(ev)} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EventChip({ event, onClick }: { event: EventRow; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="event-chip"
      onClick={onClick}
      title={event.eventName}
      className={`flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[10px] hover:brightness-95 sm:text-xs ${
        EVENT_STATUS_CHIP[event.status] ?? EVENT_STATUS_CHIP.DRAFT
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${EVENT_STATUS_DOT[event.status] ?? EVENT_STATUS_DOT.DRAFT}`} />
      <span className="truncate">{event.eventName}</span>
    </button>
  )
}

function EventCard({ event, onClick }: { event: EventRow; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="event-card"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${EVENT_STATUS_DOT[event.status] ?? EVENT_STATUS_DOT.DRAFT}`} />
          <p className="truncate text-sm font-semibold text-gray-900">{event.eventName}</p>
        </div>
        <p className="mt-1 truncate text-xs text-gray-500">
          {event.venue ?? 'No venue'}{event.timing ? ` · ${event.timing}` : ''}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-400">
          {event.owner.name} · {event._count.expenses} expense{event._count.expenses === 1 ? '' : 's'}
        </p>
      </div>
      <Badge variant={EVENT_STATUS_BADGE[event.status] ?? 'gray'}>{event.status}</Badge>
    </button>
  )
}
