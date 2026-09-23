import crypto from 'crypto'

// Generic decryptable-secret helper — not SSO-specific. Everything else in
// this codebase that stores a secret either hashes it one-way
// (VerificationToken, MfaBackupCode) or stores it in plaintext with masked
// display (mfaSecret, webhookApiKey). An SSO client secret has to be
// decrypted again later to make outbound token-exchange calls, so it needs
// real encryption at rest — this is that primitive, kept generic so
// mfaSecret/webhookApiKey are easy follow-up candidates for the same helper.
//
// Format: "v1:<base64(iv|authTag|ciphertext)>" — the version prefix costs
// nothing now and lets APP_ENCRYPTION_KEY rotate later (decrypt supports old
// versions, encrypt always uses the newest) without a flag day.

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) throw new Error('APP_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)')
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `v1:${Buffer.concat([iv, authTag, ciphertext]).toString('base64')}`
}

export function decryptSecret(blob: string): string {
  const [version, payload] = blob.split(':', 2)
  if (version !== 'v1' || !payload) throw new Error(`Unsupported secret format: ${version}`)

  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
