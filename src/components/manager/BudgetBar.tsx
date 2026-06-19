'use client'

export function BudgetBar({
  budgetPct,
  projectedPct,
  budgetBarColor,
}: {
  budgetPct: number
  projectedPct: number
  budgetBarColor: string
}) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gray-300"
        style={{ width: `${budgetPct}%` }}
      />
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all ${budgetBarColor}`}
        style={{ width: `${projectedPct}%` }}
      />
    </div>
  )
}
