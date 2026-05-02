const enc = new TextEncoder()

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function signMfaCookie(userId: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ''
  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(userId))
  return `${userId}.${toBase64Url(sig)}`
}

export async function verifyMfaCookie(cookieValue: string, userId: string): Promise<boolean> {
  try {
    const expected = await signMfaCookie(userId)
    return cookieValue === expected
  } catch {
    return false
  }
}
