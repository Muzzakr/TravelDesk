export type Role = 'EMPLOYEE' | 'MANAGER' | 'TRAVEL_MANAGER' | 'TRAVEL_AGENT' | 'FINANCE_ADMIN' | 'SYSTEM_ADMIN'

export interface User {
  id: string
  companyId: string
  email: string
  name: string
  role: Role
  managerId: string | null
  mfaEnabled: boolean
  isActive: boolean
  createdAt: Date
}

export interface SessionUser {
  id: string
  companyId: string
  email: string
  name: string
  role: Role
}
