export type EventStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'

export interface TravelEvent {
  id: string
  companyId: string
  eventCode: string
  eventName: string
  costCenter: string
  budgetUsd: number
  approvedSpendUsd: number
  dateStart: Date
  dateEnd: Date
  status: EventStatus
  ownerUserId: string
  createdAt: Date
}

export interface EventBudgetSummary {
  eventId: string
  eventName: string
  eventCode: string
  budgetUsd: number
  approvedSpendUsd: number
  remainingUsd: number
  burnPercent: number
  status: 'OK' | 'WARNING' | 'EXCEEDED'
}
