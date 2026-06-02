'use client'

import { useState } from 'react'
import { unsubscribe } from '@/lib/api'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export default function UnsubscribePage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const result = await unsubscribe(email)

    if (result.success) {
      setStatus('success')
      setMessage('You have been unsubscribed.')
    } else {
      setStatus('error')
      setMessage(result.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Unsubscribe</h1>
          <p className="text-gray-600 mb-8">We&apos;re sorry to see you go. Enter your email to unsubscribe.</p>

          {status === 'success' ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === 'error' && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{message}</div>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-field"
              />
              <button type="submit" disabled={status === 'loading'} className="btn-primary w-full">
                {status === 'loading' ? 'Processing...' : 'Unsubscribe'}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
