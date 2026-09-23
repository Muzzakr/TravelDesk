import {
  LayoutDashboard, Inbox, Plane, Receipt, CheckCircle2, BarChart3, Wallet,
  Users, Calendar, User, Workflow, Settings, Circle, CreditCard,
  SlidersHorizontal, ClipboardList, Shield, Bell, type LucideIcon,
} from 'lucide-react'

/** Sidebar nav-item icon lookup by label keyword. Shared by Sidebar.tsx (desktop). */
export function navIcon(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes('dashboard') || l.includes('home') || l.includes('admin')) return LayoutDashboard
  if (l.includes('inbox')) return Inbox
  if (l.includes('approval')) return CheckCircle2
  if (l.includes('payout')) return Wallet
  if (l.includes('card')) return CreditCard
  if (l.includes('expense')) return Receipt
  if (l.includes('travel') || l.includes('trip') || l.includes('book')) return Plane
  if (l.includes('report') || l.includes('stat')) return BarChart3
  if (l.includes('event')) return Calendar
  if (l.includes('user') || l.includes('employee')) return Users
  if (l.includes('profile')) return User
  if (l.includes('workflow')) return Workflow
  if (l.includes('policy')) return SlidersHorizontal
  if (l.includes('audit')) return ClipboardList
  if (l.includes('security')) return Shield
  if (l.includes('notification')) return Bell
  if (l.includes('setting')) return Settings
  return Circle
}
