'use client'

import { NotificationBell } from '@/components/ui/NotificationBell'
import { CompanyBrand } from '@/components/ui/CompanyBrand'

interface MobileNavProps {
  name: string
  logoUrl: string | null
  variant?: 'solid' | 'glass'
}

// Slim mobile top bar. Primary navigation lives in the BottomTabBar; the full
// menu (the long tail + log out) opens from its "More" tab.
export function MobileNav({ name, logoUrl, variant = 'solid' }: MobileNavProps) {
  return (
    <div
      className={`md:hidden fixed top-0 inset-x-0 z-40 text-white pt-[env(safe-area-inset-top)] ${
        variant === 'glass'
          ? 'bg-gradient-to-b from-[#1e1b4b]/90 to-[#1e2266]/85 backdrop-blur-md border-b border-white/10'
          : 'bg-indigo-900'
      }`}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <CompanyBrand name={name} logoUrl={logoUrl} size="sm" />
        <NotificationBell />
      </div>
    </div>
  )
}
