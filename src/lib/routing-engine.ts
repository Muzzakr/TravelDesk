import type { RoutingPath } from '@/types/travel-request'

interface RoutingInput {
  estimatedCostUsd: number
  departureDateIso: string
  servicesRequested: string[]
  requesterRole?: string
}

const MANAGER_FIRST_THRESHOLD_USD = 1500
const URGENT_HOURS = 72

export function determineRoutingPath(input: RoutingInput): RoutingPath {
  // Travel managers handle everything end-to-end — no agent step
  if (input.requesterRole === 'TRAVEL_MANAGER') return 'MANAGER_ONLY'

  const hoursUntilDeparture = getHoursUntilDeparture(input.departureDateIso)
  const isUrgent = hoursUntilDeparture <= URGENT_HOURS
  const isHighValue = input.estimatedCostUsd >= MANAGER_FIRST_THRESHOLD_USD
  const needsAgent =
    input.servicesRequested.some((s) =>
      ['FLIGHT', 'HOTEL', 'CAR_RENTAL'].includes(s)
    )

  if (!needsAgent) return 'MANAGER_ONLY'
  if (isUrgent) return 'PARALLEL'
  if (isHighValue) return 'MANAGER_FIRST'
  return 'AGENT_FIRST'
}

function getHoursUntilDeparture(departureDateIso: string): number {
  const departure = new Date(departureDateIso)
  if (isNaN(departure.getTime())) return Infinity
  const now = new Date()
  return (departure.getTime() - now.getTime()) / (1000 * 60 * 60)
}
