import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

// Post-sign-in landing: sends the user to their role's home page.
// Used as callbackUrl by Google sign-in and by the credentials and
// magic-link flows so the role → home map lives in one place.
const HOME: Record<string, string> = {
  SYSTEM_ADMIN: '/admin',
  MANAGER: '/manager',
  TRAVEL_MANAGER: '/manager',
  TRAVEL_AGENT: '/agent',
  FINANCE_ADMIN: '/finance',
}

export default async function AuthRedirectPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  redirect(HOME[session.user.role ?? ''] ?? '/employee')
}
