// Normalises the many date shapes that arrive from CSV exports / Zapier
// (e.g. "04-26-2026", "04/26/2026", "01-01-2026, 01-02-2026", "2026-04-26")
// into a canonical YYYY-MM-DD string, or undefined when unparseable/empty.
export function normaliseDateString(raw?: string | null): string | undefined {
  if (!raw) return undefined
  // Multi-date fields ("01-01-2026, 01-02-2026, …") — take the first date.
  const first = String(raw).split(',')[0].trim()
  if (!first) return undefined

  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) return first

  // US-style MM-DD-YYYY or MM/DD/YYYY
  const m = first.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const mm = m[1].padStart(2, '0')
    const dd = m[2].padStart(2, '0')
    return `${m[3]}-${mm}-${dd}`
  }

  // Fallback: let the JS engine try (handles "Apr 26, 2026" etc.)
  const d = new Date(first)
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

// Same as above but returns a Date (or undefined) ready for Prisma.
export function toDate(raw?: string | null): Date | undefined {
  const s = normaliseDateString(raw)
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}
