'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import type { ExtractedUser } from '@/app/api/users/extract/route'
import { Check, XCircle, Copy, CheckCheck } from 'lucide-react'

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  hasPassword: boolean
  managerId: string | null
  createdAt: string
  manager: { name: string } | null
}

type Manager = { id: string; name: string; role: string }

const roleBadge: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  EMPLOYEE: 'blue',
  MANAGER: 'green',
  TRAVEL_MANAGER: 'green',
  TRAVEL_AGENT: 'purple',
  FINANCE_ADMIN: 'yellow',
  SYSTEM_ADMIN: 'gray',
}

const ROLE_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'TRAVEL_MANAGER', label: 'Travel Manager' },
  { value: 'TRAVEL_AGENT', label: 'Travel Agent' },
  { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
  { value: 'SYSTEM_ADMIN', label: 'System Admin' },
]

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'EMPLOYEE' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [inviteLink, setInviteLink] = useState<{ name: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Drawer state
  const [selected, setSelected] = useState<UserRow | null>(null)

  // Edit modal state
  const [editModal, setEditModal] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', isActive: true, managerId: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Reset password modal state
  const [resetPassUser, setResetPassUser] = useState<UserRow | null>(null)
  const [resetPassVal, setResetPassVal] = useState('')
  const [resetPassVal2, setResetPassVal2] = useState('')
  const [resetPassSaving, setResetPassSaving] = useState(false)
  const [resetPassMsg, setResetPassMsg] = useState('')
  const [resetPassErr, setResetPassErr] = useState('')

  // Resend invite state
  const [resendingInvite, setResendingInvite] = useState(false)

  // Import state
  const fileRef = useRef<HTMLInputElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [preview, setPreview] = useState<ExtractedUser[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [createResults, setCreateResults] = useState<{ email: string; ok: boolean; error?: string }[] | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (res.ok) {
      setUsers(await res.json())
    } else {
      setError('Failed to load users')
    }
    setLoading(false)
  }

  async function loadManagers() {
    const res = await fetch('/api/manager/list')
    if (res.ok) setManagers(await res.json())
  }

  useEffect(() => { loadUsers(); loadManagers() }, [])

  useEffect(() => {
    if (!selected) return
    function onMouseDown(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setSelected(null)
        setEditError('')
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [selected])

  function openDetail(u: UserRow) {
    setSelected(u)
    setEditError('')
    setShowForm(false)
    setConfirmDelete(false)
  }

  function closeDrawer() {
    setSelected(null)
    setEditError('')
    setConfirmDelete(false)
  }

  function openEditModal(u: UserRow) {
    setEditForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive, managerId: u.managerId ?? '' })
    setEditError('')
    setEditModal(u)
  }

  async function deleteUser() {
    if (!selected) return
    setDeleting(true)
    const res = await fetch(`/api/users/${selected.id}`, { method: 'DELETE' })
    if (res.ok) {
      closeDrawer()
      loadUsers()
    } else {
      const d = await res.json()
      setEditError(d.error ?? 'Failed to delete user')
    }
    setDeleting(false)
    setConfirmDelete(false)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal) return
    setEditSaving(true)
    setEditError('')
    const body: Record<string, unknown> = {
      name: editForm.name,
      role: editForm.role,
      isActive: editForm.isActive,
      managerId: editForm.managerId || null,
    }
    if (editForm.email !== editModal.email) body.email = editForm.email
    const res = await fetch(`/api/users/${editModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const fresh = await fetch('/api/users').then((r) => r.json()) as UserRow[]
      setUsers(fresh)
      const updated = fresh.find((u) => u.id === editModal.id)
      if (updated) setSelected(updated)
      setEditModal(null)
    } else {
      const d = await res.json()
      setEditError(d.error ?? 'Failed to save')
    }
    setEditSaving(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setShowForm(false)
      setForm({ name: '', email: '', role: 'EMPLOYEE' })
      loadUsers()
      if (!data.emailSent && data.setPasswordUrl) {
        setInviteLink({ name: data.name, url: data.setPasswordUrl })
        setCopied(false)
      }
    } else {
      const d = await res.json()
      setFormError(d.error ?? 'Failed to create user')
    }
    setSaving(false)
  }

  async function copyInviteLink(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function resendInvite() {
    if (!selected) return
    setResendingInvite(true)
    const res = await fetch(`/api/admin/users/${selected.id}/resend-invite`, { method: 'POST' })
    const d = await res.json()
    if (!d.emailSent && d.setPasswordUrl) {
      setInviteLink({ name: selected.name, url: d.setPasswordUrl })
      setCopied(false)
    } else {
      alert(`Invite email resent to ${selected.email}`)
    }
    setResendingInvite(false)
  }

  async function submitResetPass(e: React.FormEvent) {
    e.preventDefault()
    if (!resetPassUser) return
    if (resetPassVal !== resetPassVal2) { setResetPassErr('Passwords do not match'); return }
    setResetPassSaving(true)
    setResetPassErr('')
    const res = await fetch(`/api/admin/users/${resetPassUser.id}/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: resetPassVal }),
    })
    const d = await res.json()
    if (res.ok) {
      setResetPassMsg('Password updated successfully.')
      setResetPassVal(''); setResetPassVal2('')
      loadUsers()
    } else {
      setResetPassErr(d.error ?? 'Failed to set password')
    }
    setResetPassSaving(false)
  }

  function openResetPass(u: UserRow) {
    setResetPassUser(u)
    setResetPassVal(''); setResetPassVal2('')
    setResetPassMsg(''); setResetPassErr('')
  }

  function exportCSV() {
    const rows = users.map(u => [
      u.name, u.email, u.role,
      u.isActive ? 'Active' : 'Inactive',
      u.manager?.name ?? '',
      new Date(u.createdAt).toISOString().slice(0, 10),
      u.hasPassword ? 'Yes' : 'No',
    ])
    const header = ['Name', 'Email', 'Role', 'Status', 'Manager', 'Joined', 'Password Set']
    const csv = [header, ...rows].map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setExtractError('')
    setPreview(null)
    setCreateResults(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/users/extract', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setExtractError(data.error ?? 'Extraction failed')
    } else {
      setPreview(data.users)
    }
    setExtracting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function updatePreviewRow(index: number, field: keyof ExtractedUser, value: string) {
    setPreview((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      const row = { ...updated[index], [field]: value }
      const errors: string[] = []
      if (!row.name.trim()) errors.push('Name is required')
      if (!row.email.trim()) errors.push('Email is required')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) errors.push('Email is invalid')
      updated[index] = { ...row, errors }
      return updated
    })
  }

  async function bulkCreate() {
    if (!preview) return
    setCreating(true)
    setCreateResults(null)
    const results: { email: string; ok: boolean; error?: string }[] = []
    for (const u of preview) {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: u.name, email: u.email, role: u.role }),
      })
      if (res.ok) {
        results.push({ email: u.email, ok: true })
      } else {
        const d = await res.json()
        results.push({ email: u.email, ok: false, error: d.error ?? 'Failed' })
      }
    }
    setCreateResults(results)
    setCreating(false)
    loadUsers()
  }

  const validCount = preview?.filter((u) => u.errors.length === 0).length ?? 0
  const invalidCount = (preview?.length ?? 0) - validCount
  const allValid = preview !== null && invalidCount === 0

  return (
    <div className="space-y-6">

      {/* ── Invite link fallback modal ───────────────────── */}
      {inviteLink && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => setInviteLink(null)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Email could not be sent</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {inviteLink.name} was created but the invite email failed. Share this link manually.
                  </p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setInviteLink(null)}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 flex items-center gap-2">
                <span className="flex-1 text-xs text-gray-700 font-mono truncate">{inviteLink.url}</span>
                <button type="button" onClick={() => copyInviteLink(inviteLink.url)}
                  className="shrink-0 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                  {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400">This link expires in 48 hours. Check Gmail SMTP settings in Vercel environment variables.</p>
            </div>
          </div>
        </>
      )}

      {/* ── Reset password modal ──────────────────────────── */}
      {resetPassUser && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => setResetPassUser(null)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <form onSubmit={submitResetPass}
              className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <h2 className="text-base font-semibold text-gray-900">Set new password</h2>
              <p className="text-sm text-gray-500">Setting a new password for <strong>{resetPassUser.name}</strong>.</p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">New password</label>
                <input type="password" required minLength={8} value={resetPassVal}
                  onChange={e => { setResetPassVal(e.target.value); setResetPassErr(''); setResetPassMsg('') }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="At least 8 characters" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Confirm password</label>
                <input type="password" required value={resetPassVal2}
                  onChange={e => { setResetPassVal2(e.target.value); setResetPassErr('') }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Repeat password" />
              </div>
              {resetPassErr && <p className="text-sm text-red-600">{resetPassErr}</p>}
              {resetPassMsg && <p className="text-sm text-green-600">{resetPassMsg}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={resetPassSaving}
                  className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  {resetPassSaving ? 'Saving…' : 'Set password'}
                </button>
                <button type="button" onClick={() => setResetPassUser(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Right-side detail drawer ─────────────────────── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20 pointer-events-none" />
          <div ref={drawerRef} className="fixed right-0 top-0 h-full w-full max-w-md z-[51] flex flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div className="min-w-0 pr-4">
                <p className="text-xs text-gray-400">{selected.email}</p>
                <h2 className="mt-0.5 text-lg font-semibold text-gray-900 leading-tight">{selected.name}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={closeDrawer}
                className="shrink-0 rounded-lg p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={roleBadge[selected.role] ?? 'gray'}>{selected.role.replace(/_/g, ' ')}</Badge>
                  <Badge variant={selected.isActive ? 'green' : 'gray'}>{selected.isActive ? 'Active' : 'Inactive'}</Badge>
                  {!selected.hasPassword && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Invite pending</span>
                  )}
                </div>

                <div className="h-px bg-gray-100" />

                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="Manager" value={selected.manager?.name ?? null} />
                </div>

                <DetailRow
                  label="Joined"
                  value={new Date(selected.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                />

                <div className="h-px bg-gray-100" />

                {!selected.hasPassword && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-yellow-800">This user has not set a password yet.</p>
                    <button type="button" disabled={resendingInvite} onClick={resendInvite}
                      className="shrink-0 rounded-lg bg-yellow-600 text-white px-3 py-2.5 text-xs font-medium hover:bg-yellow-700 disabled:opacity-50 min-h-[44px]">
                      {resendingInvite ? '…' : 'Resend invite'}
                    </button>
                  </div>
                )}

                <div>
                  <Link href={`/admin/users/${selected.id}`}
                    className="text-sm font-medium text-indigo-600 hover:underline">
                    View full profile →
                  </Link>
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-3 flex-wrap md:pb-4">
              {confirmDelete ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-red-600 font-medium">Delete {selected?.name}?</span>
                  <button type="button" onClick={deleteUser} disabled={deleting}
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 min-h-[44px]">
                    {deleting ? '…' : 'Yes, delete'}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <Button onClick={() => openEditModal(selected!)}>Edit</Button>
                  <button type="button" onClick={() => openResetPass(selected!)}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                    Reset password
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Edit modal ────────────────────────────────── */}
      {editModal && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/40" onClick={() => { setEditModal(null); setEditError('') }} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <form onSubmit={saveEdit}
              className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-900">Edit user</h2>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Full name</label>
                <input required title="Full name" value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Email</label>
                <input type="email" title="Email" value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Role</label>
                <select title="Role" value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Manager</label>
                <select title="Manager" value={editForm.managerId}
                  onChange={e => setEditForm({ ...editForm, managerId: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                  <option value="">— No manager —</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role.replace(/_/g, ' ')})</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select title="Status" value={editForm.isActive ? 'active' : 'inactive'}
                  onChange={e => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {editError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={editSaving}>Save changes</Button>
                <button type="button" onClick={() => { setEditModal(null); setEditError('') }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Preview panel ─────────────────────────────── */}
      {preview && (
        <div className="rounded-xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Preview — {preview.length} users</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {validCount} user{validCount !== 1 ? 's' : ''} ready
                {invalidCount > 0 && <span className="text-red-500"> · {invalidCount} with errors</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setPreview(null); setExtractError(''); setCreateResults(null) }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Discard
              </button>
              <Button onClick={bulkCreate} loading={creating} disabled={!allValid || !!createResults}>
                Create {validCount} user{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
              Each user will receive an invite email to set their own password.
            </p>

            {createResults && (
              <div className="rounded-lg bg-gray-50 p-4 space-y-1">
                <p className="text-sm font-medium text-gray-700 mb-2">Import results</p>
                {createResults.map((r) => (
                  <div key={r.email} className="flex items-center gap-2 text-sm">
                    <span className={r.ok ? 'text-green-600' : 'text-red-600'}>{r.ok ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}</span>
                    <span className="text-gray-700">{r.email}</span>
                    {r.error && <span className="text-xs text-red-500">— {r.error}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {preview.map((u, i) => (
                <div key={i} className={`rounded-xl border p-4 space-y-3 ${u.errors.length > 0 ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">User {i + 1}</span>
                    {u.errors.length > 0
                      ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">{u.errors.length} error{u.errors.length > 1 ? 's' : ''}</span>
                      : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Ready</span>
                    }
                  </div>
                  {u.errors.length > 0 && (
                    <ul className="space-y-0.5">
                      {u.errors.map((err, j) => <li key={j} className="text-xs text-red-600">• {err}</li>)}
                    </ul>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Name</label>
                      <input value={u.name} onChange={(e) => updatePreviewRow(i, 'name', e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" placeholder="Full name" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Email</label>
                      <input value={u.email} onChange={(e) => updatePreviewRow(i, 'email', e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" placeholder="email@example.com" />
                    </div>
                    <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500">Role</label>
                      <select title="Role" value={u.role} onChange={(e) => updatePreviewRow(i, 'role', e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none">
                        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">User management</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Export CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" aria-label="Upload user file"
            className="hidden" onChange={handleFileChange} />
          <button type="button"
            onClick={() => { setPreview(null); setExtractError(''); setCreateResults(null); fileRef.current?.click() }}
            disabled={extracting}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
            {extracting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Reading file…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Upload file
              </>
            )}
          </button>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add user'}</Button>
        </div>
      </div>

      {extractError && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Could not read file</p>
          <p className="mt-1">{extractError}</p>
        </div>
      )}

      {!preview && !extracting && (
        <p className="text-xs text-gray-400">
          Upload a <strong>CSV</strong> or <strong>Excel (.xlsx)</strong> file — the system will extract user data and show a preview before creating accounts.
        </p>
      )}

      {/* ── Create form ──────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-800">New user</h2>
          <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Full name</label>
              <input required title="Full name" placeholder="Full name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input type="email" required title="Email" placeholder="email@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <p className="text-xs text-indigo-500 mt-0.5">An invite email will be sent automatically.</p>
            </div>
            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <select title="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {formError && <p className="col-span-1 sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</p>}
            <div className="col-span-1 sm:col-span-2">
              <Button type="submit" loading={saving}>Create user</Button>
            </div>
          </form>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {/* ── User list ───────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : users.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          No users yet. Click &quot;+ Add user&quot; or upload a CSV to get started.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <button key={u.id} type="button" onClick={() => openDetail(u)}
                className="w-full text-left rounded-xl border bg-white p-4 space-y-2 hover:bg-gray-50 active:bg-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={roleBadge[u.role] ?? 'gray'}>{u.role.replace(/_/g, ' ')}</Badge>
                  {u.manager && <span className="text-xs text-gray-400">Manager: {u.manager.name}</span>}
                  {!u.hasPassword && <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">Pending</span>}
                </div>
                <p className="text-xs text-gray-400">Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[500px] w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Manager</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} onClick={() => openDetail(u)}
                    className="hover:bg-indigo-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[128px]">{u.name}</p>
                      {!u.hasPassword && <span className="text-[10px] font-medium text-yellow-600">Invite pending</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadge[u.role] ?? 'gray'}>{u.role.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-[128px]">{u.manager?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
