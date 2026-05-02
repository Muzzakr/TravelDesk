import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-indigo-600">
          Newsletter
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/archive" className="text-gray-600 hover:text-indigo-600 transition-colors">
            Archive
          </Link>
          <Link href="/unsubscribe" className="text-gray-600 hover:text-indigo-600 transition-colors">
            Unsubscribe
          </Link>
        </nav>
        <Link href="/#signup" className="btn-primary text-sm py-2 px-4">
          Subscribe
        </Link>
      </div>
    </header>
  )
}
