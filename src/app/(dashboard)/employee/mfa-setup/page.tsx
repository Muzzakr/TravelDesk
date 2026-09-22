import { redirect } from 'next/navigation'

// This route isn't linked from anywhere in the app anymore — MFA setup lives
// at /settings/security now. Redirecting (rather than deleting the file)
// means a stale bookmark or old link still lands somewhere useful.
export default function MfaSetupPage() {
  redirect('/settings/security')
}
