import type { DefaultSession } from 'next-auth'
import type { Role } from './user'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      companyId: string
      role: Role
      mfaEnabled: boolean
      mfaVerified: boolean
    }
  }
}
