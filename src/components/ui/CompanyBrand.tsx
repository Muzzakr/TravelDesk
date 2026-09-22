interface CompanyBrandProps {
  name: string
  logoUrl: string | null
  size?: 'sm' | 'md'
  className?: string
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

const SIZES = {
  sm: { badge: 'h-8 w-8 p-1', text: 'text-sm', initials: 'text-xs', gap: 'gap-2' },
  md: { badge: 'h-10 w-10 p-1.5', text: 'text-sm', initials: 'text-sm', gap: 'gap-2.5' },
}

/** Circular company logo (or initials fallback) with the company name beside it — used in the dashboard sidebar and mobile top bar so every company sees its own branding. */
export function CompanyBrand({ name, logoUrl, size = 'md', className }: CompanyBrandProps) {
  const s = SIZES[size]
  return (
    <div className={`flex min-w-0 items-center ${s.gap} ${className ?? ''}`}>
      <div className={`flex shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white ${s.badge}`}>
        {logoUrl ? (
          // Decorative: the company name is always rendered as adjacent
          // accessible text right next to this image, so an empty alt
          // avoids a screen reader announcing the name twice.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className={`font-semibold text-indigo-700 ${s.initials}`}>{getInitials(name)}</span>
        )}
      </div>
      <span className={`truncate font-semibold text-white ${s.text}`}>{name}</span>
    </div>
  )
}
