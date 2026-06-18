'use client'

import { useState } from 'react'
import { bookDemo } from '@/lib/api'
import { CheckCircle2 } from 'lucide-react'

const inputCls =
  'w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent'

export function DemoForm() {
  const [form, setForm] = useState({ name: '', workEmail: '', company: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  function update(field: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    const result = await bookDemo(form)
    if (result.success) {
      setStatus('success')
    } else {
      setStatus('error')
      setError(result.error ?? 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
        <p className="font-semibold text-green-800">Thanks, {form.name.split(' ')[0] || 'there'}!</p>
        <p className="text-sm text-green-700 mt-1">We&apos;ve received your request and will be in touch shortly.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Your name"
          className={inputCls}
        />
        <input
          type="text"
          required
          value={form.company}
          onChange={(e) => update('company', e.target.value)}
          placeholder="Company"
          className={inputCls}
        />
      </div>
      <input
        type="email"
        required
        value={form.workEmail}
        onChange={(e) => update('workEmail', e.target.value)}
        placeholder="Work email"
        className={inputCls}
      />
      <textarea
        value={form.message}
        onChange={(e) => update('message', e.target.value)}
        placeholder="What would you like to see? (optional)"
        rows={3}
        className={`${inputCls} resize-none`}
      />
      {status === 'error' && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full px-6 py-3 font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? 'Sending…' : 'Book a demo'}
      </button>
    </form>
  )
}
