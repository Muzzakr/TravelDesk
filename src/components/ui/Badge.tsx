type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
}

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}

export function statusToBadgeVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    DRAFT: 'gray',
    SUBMITTED: 'blue',
    UNDER_REVIEW: 'blue',
    PENDING_AGENT: 'purple',
    PENDING_MANAGER: 'yellow',
    PENDING_ADMIN: 'yellow',
    APPROVED: 'green',
    BOOKING_CONFIRMED: 'green',
    PAID: 'green',
    GENERATED: 'blue',
    FINANCE_REVIEWED: 'purple',
    EXPORTED: 'green',

    REJECTED: 'red',
    CANCELLED: 'red',
    ACTIVE: 'green',
    CLOSED: 'gray',
  }
  return map[status] ?? 'gray'
}
