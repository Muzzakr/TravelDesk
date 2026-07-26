// Local-timezone date-grid helpers for the events calendar. Deliberately
// using local Date getters (not UTC) to stay consistent with how the rest
// of the app already displays `eventDate` (new Date(iso).toLocaleDateString()
// everywhere) — an event that shows as "01/01/2026" in the detail drawer
// must land in the Jan 1 cell here too.

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - r.getDay())
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + n)
  return r
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Local YYYY-MM-DD key, used to group events by day and to key grid cells. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 6 rows x 7 cols starting on the Sunday on/before the 1st of the month. */
export function monthGridDays(monthStart: Date): Date[] {
  const gridStart = startOfWeek(monthStart)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
