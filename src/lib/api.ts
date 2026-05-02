export interface SubscribeResult {
  success: boolean
  error?: string
}

export async function subscribe(email: string): Promise<SubscribeResult> {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.message ?? 'Subscription failed' }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

export async function unsubscribe(email: string): Promise<SubscribeResult> {
  try {
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return { success: false, error: 'Could not unsubscribe' }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}
