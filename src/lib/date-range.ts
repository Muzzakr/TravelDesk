/** Returns a Date `days` days after `from` (defaults to now). */
export function daysFromNow(days: number, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}
