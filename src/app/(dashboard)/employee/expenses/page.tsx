'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { compressImageFile } from '@/lib/compress'
import { useSearchParams, useRouter } from 'next/navigation'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { FileUpload } from '@/components/ui/FileUpload'
import { LoadError } from '@/components/ui/LoadError'
import type { Expense } from '@/types/expense'
import { Check, AlertTriangle, Plus } from 'lucide-react'
import { NewExpenseForm } from '@/components/expenses/NewExpenseForm'

const EXPENSE_DRAFT_KEY = 'expense_draft_v2'

// ─── Main content ─────────────────────────────────────────────────────────────

function ExpensesContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [showForm, setShowForm]     = useState(params.get('add') === '1')
  const [manager, setManager]       = useState<{ name: string; email: string } | null | undefined>(undefined)
  const [addingReceiptFor, setAddingReceiptFor]       = useState<string | null>(null)
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<string | null>(null)
  const [receiptUploadError, setReceiptUploadError]   = useState('')
  const [notice, setNotice]                           = useState('')

  const [loadError, setLoadError] = useState(false)

  async function loadInitial() {
    setLoadError(false)
    try {
      const res = await fetch('/api/expenses')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setExpenses(await res.json())
    } catch {
      setLoadError(true)
    }
    // The manager hint is non-critical — the page works without it
    fetch('/api/users/me').then(r => r.json()).then(data => setManager(data.manager ?? null)).catch(() => {})
  }

  useEffect(() => { loadInitial() }, [])

  // Re-open the form if a draft is in progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPENSE_DRAFT_KEY)
      if (raw && JSON.parse(raw)?.form?.eventId) setShowForm(true)
    } catch { /* ignore */ }
  }, [])

  async function refreshExpenses() {
    const refreshed = await fetch('/api/expenses', { cache: 'no-store' }).then(r => r.json())
    setExpenses(refreshed)
  }

  const canAddReceipt = (status: string) => !['PAID', 'REJECTED', 'APPROVED'].includes(status)

  async function handleQuickReceiptUpload(expenseId: string, file: File) {
    setUploadingReceiptFor(expenseId)
    setReceiptUploadError('')
    const compressed = await compressImageFile(file)
    const fd = new FormData()
    fd.append('file', compressed)
    fd.append('expenseId', expenseId)
    const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd })
    if (!res.ok) {
      let msg = `Upload failed (${res.status})`
      try { const d = await res.json(); msg = d.error ?? msg } catch {}
      setReceiptUploadError(msg)
    } else {
      setAddingReceiptFor(null)
      setReceiptUploadError('')
      await refreshExpenses()
    }
    setUploadingReceiptFor(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 whitespace-nowrap rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            + Add expense
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" className="shrink-0 text-amber-500 hover:text-amber-700 font-medium">×</button>
        </div>
      )}

      {showForm && (
        <div className="mx-auto max-w-2xl">
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <NewExpenseForm
              draftKey={EXPENSE_DRAFT_KEY}
              manager={manager ?? null}
              onCancel={() => setShowForm(false)}
              onSaved={async (uploadNotice) => {
                setNotice(uploadNotice ?? '')
                setShowForm(false)
                await refreshExpenses()
              }}
            />
          </div>
        </div>
      )}

      {loadError && <LoadError onRetry={loadInitial} />}

      {/* Mobile cards */}
      {!loadError && <div className="sm:hidden space-y-3">
        {expenses.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No expenses yet.</p>
        ) : expenses.map((exp) => (
          <div key={exp.id} onClick={() => router.push(`/employee/expenses/${exp.id}`)}
            className="cursor-pointer rounded-xl border bg-white px-4 py-3 space-y-2 active:bg-gray-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{exp.description}</p>
                <p className="text-xs text-gray-400">{exp.category}</p>
              </div>
              <Badge variant={statusToBadgeVariant(exp.status)}>{exp.status}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800">${Number(exp.amountUsd).toFixed(2)}</span>
              <span className="text-xs text-gray-400">{exp.transactionDate ? new Date(exp.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</span>
            </div>
            {canAddReceipt(exp.status) && (exp.receipts?.length ?? 0) === 0 && (
              // Quick receipt attach stays inline — clicks must not open the detail page
              <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                {addingReceiptFor === exp.id ? (
                  <div className="space-y-2">
                    <FileUpload
                      label={uploadingReceiptFor === exp.id ? 'Uploading…' : 'Select receipt'}
                      hint="JPG, PNG, PDF, WebP — max 10 MB"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      disabled={uploadingReceiptFor === exp.id}
                      onFile={(file) => handleQuickReceiptUpload(exp.id, file)}
                    />
                    {receiptUploadError && addingReceiptFor === exp.id && (
                      <p className="text-xs text-red-600">{receiptUploadError}</p>
                    )}
                    <button type="button" onClick={() => { setAddingReceiptFor(null); setReceiptUploadError('') }}
                      className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingReceiptFor(exp.id)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> No receipt — Attach missing receipt
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>}

      {/* Desktop table */}
      {!showForm && !loadError && <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white shadow-sm">
        {expenses.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No expenses yet.</p>
        ) : (
          <table className="min-w-[600px] w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Receipt</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((exp) => (
                <React.Fragment key={exp.id}>
                  <tr onClick={() => router.push(`/employee/expenses/${exp.id}`)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{exp.description}</td>
                    <td className="px-4 py-3 text-gray-500">{exp.category}</td>
                    <td className="px-4 py-3 font-medium">${Number(exp.amountUsd).toFixed(2)}</td>
                    <td className="px-4 py-3"><Badge variant={statusToBadgeVariant(exp.status)}>{exp.status}</Badge></td>
                    <td className="px-4 py-3">
                      {(exp.receipts?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="w-3.5 h-3.5" /> {exp.receipts!.length}</span>
                      ) : canAddReceipt(exp.status) ? (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setAddingReceiptFor(addingReceiptFor === exp.id ? null : exp.id); setReceiptUploadError('') }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Attach missing receipt
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{exp.transactionDate ? new Date(exp.transactionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}</td>
                  </tr>
                  {addingReceiptFor === exp.id && (
                    <tr>
                      <td colSpan={6} className="px-4 pb-3 bg-amber-50">
                        <div className="max-w-sm space-y-2 pt-2">
                          <FileUpload
                            label={uploadingReceiptFor === exp.id ? 'Uploading…' : 'Select receipt file'}
                            hint="JPG, PNG, PDF, WebP — max 10 MB"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            disabled={uploadingReceiptFor === exp.id}
                            onFile={(file) => handleQuickReceiptUpload(exp.id, file)}
                          />
                          {receiptUploadError && <p className="text-xs text-red-600">{receiptUploadError}</p>}
                          <button type="button" onClick={() => { setAddingReceiptFor(null); setReceiptUploadError('') }}
                            className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>}

      {/* Mobile floating add button */}
      {!showForm && (
        <button type="button"
          onClick={() => setShowForm(true)}
          aria-label="Add expense"
          className="md:hidden fixed right-5 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700">
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesContent />
    </Suspense>
  )
}
