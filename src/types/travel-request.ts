export type TravelRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_AGENT'
  | 'PENDING_MANAGER'
  | 'OPTIONS_PROVIDED'
  | 'APPROVED'
  | 'BOOKING_CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'

export type RoutingPath = 'AGENT_FIRST' | 'MANAGER_FIRST' | 'PARALLEL' | 'MANAGER_ONLY'

export type TravelClass = 'ECONOMY' | 'BUSINESS' | 'FIRST'

export interface TravelDates {
  departureDate: string
  returnDate: string
}

export interface TravelRequest {
  id: string
  companyId: string
  employeeId: string
  agentId: string | null
  eventId: string
  origin: string
  destination: string
  travelDates: TravelDates
  servicesRequested: string[]
  estimatedCostUsd: number | null
  purpose: string
  preferredClass: TravelClass
  hotelNights: number | null
  carRentalDays: number | null
  specialInstructions: string | null
  status: TravelRequestStatus
  routingPath: RoutingPath
  rejectionNote: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTravelRequestInput {
  eventId: string
  origin: string
  destination: string
  travelDates: TravelDates
  servicesRequested: string[]
  estimatedCostUsd?: number
  purpose: string
  preferredClass?: TravelClass
  hotelNights?: number
  carRentalDays?: number
  specialInstructions?: string
}
