'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'

function ReceiptRow({ id, fileName }: { id: string; fileName: string }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    const res = await fetch(`/api/receipts/${id}/url`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    }
    setLoading(false)
  }

  const isPdf = fileName.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg">{isPdf ? '📄' : '🖼️'}</span>
        <span className="truncate text-gray-700">{fileName}</span>
      </div>
      <button
        onClick={open}
        disabled={loading}
        className="ml-3 shrink-0 text-indigo-600 font-medium hover:underline disabled:opacity-50"
      >
        {loading ? 'Opening…' : 'View'}
      </button>
    </div>
  )
}

export default function ApproveExpensePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [expense, setExpense] = useState<Record<string, unknown> | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/expenses/${id}`).then((r) => r.json()).then(setExpense)
  }, [id])

  async function handle(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) {
      setError('A note is required when rejecting.')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionNote: status === 'REJECTED' ? note : undefined }),
    })
    if (res.ok) {
      router.push('/manager')
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed')
      setLoading(false)
    }
  }

  if (!expense) return <div className="p-8 text-gray-400">Loading…</div>

  const emp = expense.employee as { name: string; email: string }
  const ev = expense.event as { eventName: string }
  const receipts = (expense.receipts as { id: string; fileName: string }[]) ?? []
  const actions = (expense.approvalActions as { actionType: string; note?: string; createdAt: string; actor: { name: string } }[]) ?? []
  const status = String(expense.status)
  const isDecided = ['APPROVED', 'REJECTED', 'PAID'].includes(status)

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Review expense</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Employee</span><p className="font-medium text-gray-900">{emp.name}</p></div>
          <div><span className="text-gray-500">Event</span><p className="font-medium text-gray-900">{ev.eventName}</p></div>
          <div><span className="text-gray-500">Description</span><p className="font-medium text-gray-900">{String(expense.description)}</p></div>
          <div><span className="text-gray-500">Category</span><p className="font-medium text-gray-900">{String(expense.category)}</p></div>
          <div><span className="text-gray-500">Amount</span><p className="text-xl font-bold text-gray-900">${Number(expense.amountUsd).toFixed(2)}</p></div>
          <div><span className="text-gray-500">Status</span><p><Badge variant={statusToBadgeVariant(status)}>{status}</Badge></p></div>
        </div>

        {/* Receipts */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Receipts</p>
          {receipts.length === 0 ? (
            <p className="text-sm text-gray-400">No receipt attached.</p>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => (
                <ReceiptRow key={r.id} id={r.id} fileName={r.fileName} />
              ))}
            </div>
          )}
        </div>

        {/* Approval history */}
        {actions.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">History</p>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    a.actionType === 'APPROVE' ? 'bg-green-100 text-green-700' :
                    a.actionType === 'REJECT' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{a.actionType}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{a.actor.name}</span>
                    {a.note && <p className="text-gray-500 mt-0.5 text-xs">{a.note}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isDecided && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Note (required for rejection)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Add a note…"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button onClick={() => handle('APPROVED')} loading={loading}>Approve</Button>
              <Button variant="danger" onClick={() => handle('REJECTED')} loading={loading}>Reject</Button>
              <Button variant="secondary" onClick={() => router.back()}>Back</Button>
            </div>
          </>
        )}

        {isDecided && (
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => router.back()}>Back</Button>
          </div>
        )}
      </div>
    </div>
  )
}
