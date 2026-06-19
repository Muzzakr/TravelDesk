'use client'

import { NotificationBell } from '@/components/ui/NotificationBell'

// Slim mobile top bar. Primary navigation lives in the BottomTabBar; the full
// menu (the long tail + log out) opens from its "More" tab.
export function MobileNav() {
  return (
    <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-indigo-900 text-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-4">
        <span className="text-base font-bold">M4U Travel</span>
        <NotificationBell />
      </div>
    </div>
  )
}
