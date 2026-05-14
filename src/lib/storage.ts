const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'receipts'

function headers(extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  }
}

export async function uploadReceipt(key: string, body: Buffer, mimeType: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': mimeType }),
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Storage upload failed (${res.status}): ${text}`)
  }
}

export async function getReceiptUrl(key: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${key}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (!res.ok) throw new Error('Failed to generate signed URL')
  const { signedURL } = await res.json()
  return `${SUPABASE_URL}${signedURL}`
}

export async function deleteReceipt(key: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [key] }),
  })
}

export function buildReceiptKey(companyId: string, expenseId: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${companyId}/${expenseId}/${Date.now()}_${sanitized}`
}
