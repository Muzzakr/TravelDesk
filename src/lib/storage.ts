import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY  = (
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  ''
)
const BUCKET = 'receipts'
const PROFILES_BUCKET = 'profiles'

function getClient() {
  try {
    const payload = JSON.parse(atob(SERVICE_KEY.split('.')[1] ?? ''))
    if (payload.role !== 'service_role') {
      console.warn('[storage] WARNING: SUPABASE_SERVICE_ROLE_KEY has role=%s — expected service_role. Uploads will likely fail.', payload.role)
    }
  } catch { /* not a JWT or already warned */ }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

export async function uploadReceipt(key: string, body: Buffer, mimeType: string): Promise<void> {
  const { error } = await getClient()
    .storage
    .from(BUCKET)
    .upload(key, body, { contentType: mimeType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
}

export async function getReceiptUrl(key: string): Promise<string> {
  const { data, error } = await getClient()
    .storage
    .from(BUCKET)
    .createSignedUrl(key, 3600)
  if (error || !data?.signedUrl) throw new Error('Failed to generate signed URL')
  return data.signedUrl
}

export async function deleteReceipt(key: string): Promise<void> {
  await getClient().storage.from(BUCKET).remove([key])
}

export function buildReceiptKey(companyId: string, expenseId: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${companyId}/${expenseId}/${Date.now()}_${sanitized}`
}

export async function uploadProfilePhoto(key: string, body: Buffer, mimeType: string): Promise<void> {
  const { error } = await getClient()
    .storage
    .from(PROFILES_BUCKET)
    .upload(key, body, { contentType: mimeType, upsert: true })
  if (error) throw new Error(`Profile photo upload failed: ${error.message}`)
}

export async function getProfilePhotoUrl(key: string): Promise<string> {
  const { data, error } = await getClient()
    .storage
    .from(PROFILES_BUCKET)
    .createSignedUrl(key, 3600)
  if (error || !data?.signedUrl) throw new Error('Failed to generate signed URL')
  return data.signedUrl
}

export async function deleteProfilePhoto(key: string): Promise<void> {
  await getClient().storage.from(PROFILES_BUCKET).remove([key])
}

export function buildProfilePhotoKey(companyId: string, userId: string, field: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${companyId}/${userId}/${field}_${Date.now()}_${sanitized}`
}
