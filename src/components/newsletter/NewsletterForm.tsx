'use client'

import { useState } from 'react'
import { subscribe } from '@/lib/api'
import { PartyPopper } from 'lucide-react'

interface NewsletterFormProps {
  dark?: boolean
}

export function NewsletterForm({ dark = false }: NewsletterFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const result = await subscribe(email)

    if (result.success) {
      setStatus('success')
      setMessage('You are now subscribed!')
      setEmail('')
    } else {
      setStatus('error')
      setMessage(result.error ?? 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className={`p-4 rounded-lg text-center ${dark ? 'bg-indigo-500 text-white' : 'bg-green-50 text-green-700'}`}>
        <p className="inline-flex items-center gap-2 font-semibold text-lg"><PartyPopper className="w-5 h-5" /> {message}</p>
        <p className="text-sm mt-1 opacity-80">Check your inbox to confirm your subscription.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3" id="signup">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className={`flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          dark
            ? 'bg-white text-gray-900 border-transparent'
            : 'bg-white text-gray-900 border-gray-300'
        }`}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className={`px-6 py-3 font-semibold rounded-lg transition-colors disabled:opacity-50 ${
          dark
            ? 'bg-white text-indigo-600 hover:bg-indigo-50'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
      </button>
      {status === 'error' && (
        <p className="text-red-500 text-sm mt-1 w-full">{message}</p>
      )}
    </form>
  )
}
