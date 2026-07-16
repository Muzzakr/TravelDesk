/**
 * @jest-environment node
 *
 * The routing engine decides whether a travel request goes to the
 * agent, the manager, or both — this drives who sees a request and
 * how fast. Pure function, no mocks needed.
 */
import { determineRoutingPath } from '@/lib/routing-engine'

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

describe('determineRoutingPath', () => {
  it('routes Travel Managers end-to-end regardless of cost, urgency or services', () => {
    const path = determineRoutingPath({
      estimatedCostUsd: 999999,
      departureDateIso: hoursFromNow(1), // urgent
      servicesRequested: ['FLIGHT', 'HOTEL'],
      requesterRole: 'TRAVEL_MANAGER',
    })
    expect(path).toBe('MANAGER_ONLY')
  })

  it('skips the agent when no bookable service is requested', () => {
    const path = determineRoutingPath({
      estimatedCostUsd: 5000,
      departureDateIso: hoursFromNow(200),
      servicesRequested: ['TAXI'], // not in FLIGHT/HOTEL/CAR_RENTAL
      requesterRole: 'EMPLOYEE',
    })
    expect(path).toBe('MANAGER_ONLY')
  })

  it('routes urgent requests (<=72h to departure) in parallel, even if high value', () => {
    const path = determineRoutingPath({
      estimatedCostUsd: 5000,
      departureDateIso: hoursFromNow(24),
      servicesRequested: ['FLIGHT'],
      requesterRole: 'EMPLOYEE',
    })
    expect(path).toBe('PARALLEL')
  })

  it('routes high-value non-urgent requests to the manager first', () => {
    const path = determineRoutingPath({
      estimatedCostUsd: 1500, // >= threshold
      departureDateIso: hoursFromNow(200),
      servicesRequested: ['HOTEL'],
      requesterRole: 'EMPLOYEE',
    })
    expect(path).toBe('MANAGER_FIRST')
  })

  it('routes low-value non-urgent requests to the agent first', () => {
    const path = determineRoutingPath({
      estimatedCostUsd: 1499.99, // just under threshold
      departureDateIso: hoursFromNow(200),
      servicesRequested: ['CAR_RENTAL'],
      requesterRole: 'EMPLOYEE',
    })
    expect(path).toBe('AGENT_FIRST')
  })

  it('treats an unparseable departure date as non-urgent', () => {
    const path = determineRoutingPath({
      estimatedCostUsd: 100,
      departureDateIso: '',
      servicesRequested: ['FLIGHT'],
      requesterRole: 'EMPLOYEE',
    })
    expect(path).toBe('AGENT_FIRST')
  })
})
