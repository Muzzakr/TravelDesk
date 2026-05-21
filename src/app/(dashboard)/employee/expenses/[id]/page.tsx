'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FileUpload } from '@/components/ui/FileUpload'
import Link from 'next/link'
import { DateInput } from '@/components/ui/DateInput'

interface Receipt {
  id: string
  fileName: string
  mimeType: string
  ocrMerchant: string | null
  ocrAmount: string | null
  ocrDate: string | null
  uploadedAt: string
}

interface Comment {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

interface ApprovalAction {
  actionType: string
  note: string | null
  createdAt: string
  actor: { name: string; role: string }
}

interface ExpenseDetail {
  id: string
  description: string
  category: string
  amountUsd: number
  currency: string
  status: string
  merchantName: string | null
  transactionDate: string | null
  rejectionNote: string | null
  createdAt: string
  event: { eventName: string; eventCode: string }
  receipts: Receipt[]
  comments: Comment[]
  approvalActions: ApprovalAction[]
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  DRAFT: 'Saved but not yet submitted for approval.',
  SUBMITTED: 'Submitted — waiting for manager review.',
  UNDER_REVIEW: 'Your manager is reviewing this expense.',
  APPROVED: 'Approved and queued for reimbursement.',
  REJECTED: 'Rejected. See the note below for details.',
  PAID: 'Reimbursed and included in a payout report.',
}

const inputCls = 'rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200'

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ amountUsd: '', description: '', merchantName: '', transactionDate: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    const [expRes, sessionRes] = await Promise.all([
      fetch(`/api/expenses/${id}`, { cache: 'no-store' }),
      fetch('/api/auth/session'),
    ])
    if (expRes.ok) {
      const data = await expRes.json()
      setExpense(data)
      setEditForm({
        amountUsd: String(Number(data.amountUsd)),
        description: data.description,
        merchantName: data.merchantName ?? '',
        transactionDate: data.transactionDate
          ? new Date(data.transactionDate).toISOString().slice(0, 10)
          : '',
      })
    }
    const session = await sessionRes.json()
    setCurrentUserId(session?.user?.id ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function loadReceiptUrl(receiptId: string) {
    setLoadingUrls((prev) => ({ ...prev, [receiptId]: true }))
    const res = await fetch(`/api/receipts/${receiptId}/url`)
    if (res.ok) {
      const { url } = await res.json()
      setReceiptUrls((prev) => ({ ...prev, [receiptId]: url }))
    }
    setLoadingUrls((prev) => ({ ...prev, [receiptId]: false }))
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmittingComment(true)
    await fetch(`/api/expenses/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentText }),
    })
    setCommentText('')
    await load()
    setSubmittingComment(false)
  }

  async function handleReceiptUpload(file: File) {
    const MAX_BYTES = 10 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setUploadError('File too large — maximum size is 10 MB.')
      return
    }
    setUploadingReceipt(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('expenseId', id)
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        let errorMsg = `Upload failed (${res.status})`
        try {
          const d = await res.json()
          errorMsg = d.error ?? errorMsg
        } catch {
          // response wasn't JSON — keep the status message
        }
        setUploadError(errorMsg)
      } else {
        await load()
      }
    } catch {
      setUploadError('Network error — please check your connection and try again.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  async function saveEdit() {
    setSavingEdit(true)
    setEditError('')
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUsd: Number(editForm.amountUsd),
        description: editForm.description,
        merchantName: editForm.merchantName || undefined,
        transactionDate: editForm.transactionDate || undefined,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setEditError(d.error ?? 'Save failed')
    } else {
      setEditMode(false)
      await load()
    }
    setSavingEdit(false)
  }

  async function submitExpense() {
    setSubmitting(true)
    await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUBMITTED' }),
    })
    await load()
    setSubmitting(false)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!expense) return <div className="p-8 text-red-500">Expense not found.</div>

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link href="/employee/expenses" className="text-xs text-indigo-600 hover:underline">← All expenses</Link>
          {editMode ? (
            <input
              title="Description"
              className={`mt-1 w-full text-2xl font-bold text-gray-900 ${inputCls}`}
              value={editForm.description}
              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
            />
          ) : (
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{expense.description}</h1>
          )}
          <p className="text-sm text-gray-500">{expense.event.eventName} · {expense.category}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant={statusToBadgeVariant(expense.status)}>{expense.status}</Badge>
          {expense.status === 'DRAFT' && !editMode && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Status explanation */}
      {STATUS_DESCRIPTIONS[expense.status] && (
        <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {STATUS_DESCRIPTIONS[expense.status]}
        </div>
      )}

      {/* Rejection note */}
      {expense.status === 'REJECTED' && expense.rejectionNote && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Rejection reason</p>
          <p className="mt-1 text-sm text-red-700">{expense.rejectionNote}</p>
        </div>
      )}

      {/* Expense details */}
      <div className="rounded-xl border bg-white p-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Amount</p>
          {editMode ? (
            <input
              type="number" step="0.01" min="0"
              title="Amount (USD)"
              value={editForm.amountUsd}
              onChange={e => setEditForm(p => ({ ...p, amountUsd: e.target.value }))}
              className={`w-28 ${inputCls}`}
            />
          ) : (
            <p className="text-lg font-bold text-gray-900">${Number(expense.amountUsd).toFixed(2)} {expense.currency}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Category</p>
          <p className="text-gray-900">{expense.category}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Merchant</p>
          {editMode ? (
            <input
              type="text"
              value={editForm.merchantName}
              onChange={e => setEditForm(p => ({ ...p, merchantName: e.target.value }))}
              placeholder="Restaurant or vendor"
              className={`w-full ${inputCls}`}
            />
          ) : (
            <p className="text-gray-900">{expense.merchantName ?? '—'}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Date</p>
          {editMode ? (
            <DateInput
              title="Date"
              value={editForm.transactionDate}
              onChange={v => setEditForm(p => ({ ...p, transactionDate: v }))}
              className={inputCls}
            />
          ) : (
            <p className="text-gray-900">
              {expense.transactionDate
                ? new Date(expense.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                : '—'}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Event</p>
          <p className="text-gray-900">{expense.event.eventName} ({expense.event.eventCode})</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Submitted</p>
          <p className="text-gray-500">{new Date(expense.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Edit mode action bar */}
      {editMode && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={saveEdit}
            disabled={savingEdit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingEdit ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => { setEditMode(false); setEditError('') }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          {editError && <p className="text-sm text-red-600">{editError}</p>}
        </div>
      )}

      {/* Actions for DRAFT (submit) — only in read mode */}
      {expense.status === 'DRAFT' && !editMode && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={submitExpense}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      )}

      {/* Receipts */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Receipts</h2>
        {expense.receipts.length === 0 ? (
          <p className="text-sm text-gray-400">No receipts attached.</p>
        ) : (
          <div className="space-y-3">
            {expense.receipts.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.fileName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Uploaded {new Date(r.uploadedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
                  </div>
                  {receiptUrls[r.id] ? (
                    <a
                      href={receiptUrls[r.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Open receipt →
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => loadReceiptUrl(r.id)}
                      disabled={loadingUrls[r.id]}
                      className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      {loadingUrls[r.id] ? 'Loading…' : 'View receipt →'}
                    </button>
                  )}
                </div>
                {(r.ocrMerchant || r.ocrAmount || r.ocrDate) && (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs">
                    <div>
                      <p className="text-indigo-400 font-medium uppercase">Merchant (OCR)</p>
                      <p className="mt-0.5 text-indigo-800">{r.ocrMerchant ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-indigo-400 font-medium uppercase">Amount (OCR)</p>
                      <p className="mt-0.5 text-indigo-800">{r.ocrAmount ? `$${Number(r.ocrAmount).toFixed(2)}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-indigo-400 font-medium uppercase">Date (OCR)</p>
                      <p className="mt-0.5 text-indigo-800">{r.ocrDate ? new Date(r.ocrDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload receipt — only for DRAFT in edit mode */}
        {expense.status === 'DRAFT' && editMode && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase">Add receipt</p>
            <FileUpload
              label={uploadingReceipt ? 'Uploading…' : 'Add another receipt'}
              hint="JPG, PNG, PDF, WebP — max 10 MB"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploadingReceipt}
              onFile={handleReceiptUpload}
            />
            {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
          </div>
        )}
      </div>

      {/* Approval history */}
      {expense.approvalActions.length > 0 && (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-800">Approval history</h2>
          <div className="space-y-3">
            {expense.approvalActions.map((action, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                <div>
                  <p className="font-medium text-gray-900">
                    {action.actor.name} <span className="text-gray-400 font-normal">({action.actionType})</span>
                  </p>
                  {action.note && <p className="text-xs text-gray-500 mt-0.5">"{action.note}"</p>}
                  <p className="text-xs text-gray-400">{new Date(action.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Comments</h2>
        {expense.comments.length === 0 ? (
          <p className="mb-4 text-sm text-gray-400">No comments yet.</p>
        ) : (
          <div className="mb-4 space-y-3">
            {expense.comments.map((c) => (
              <div key={c.id} className={`rounded-lg p-3 text-sm ${c.authorId === currentUserId ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-gray-900">
                    {c.authorId === currentUserId ? 'You' : c.authorName}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                </div>
                <p className="text-gray-700">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={postComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submittingComment || !commentText.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submittingComment ? '…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
