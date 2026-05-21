import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function AuditLogPage() {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId

  const logs = await prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { name: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-400">Showing last {logs.length} entries (append-only, 7-year retention)</p>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No audit log entries yet.</p>
        ) : logs.map((log) => (
          <div key={log.id} className="rounded-xl border bg-white px-4 py-3 space-y-1">
            <p className="font-mono text-xs font-medium text-gray-800">{log.action}</p>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{log.entityType} · {log.actor?.name ?? 'System'}</span>
              <span>{new Date(log.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[700px] w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity type</th>
              <th className="px-4 py-3 text-left">Entity ID</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No audit log entries yet.</td>
              </tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">{log.action}</td>
                <td className="px-4 py-3 text-gray-500">{log.entityType}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.entityId.slice(0, 12)}…</td>
                <td className="px-4 py-3 text-gray-500">{log.actor?.name ?? 'System'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

