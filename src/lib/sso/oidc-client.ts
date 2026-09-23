import * as client from 'openid-client'
import { decryptSecret } from '@/lib/crypto/secret-box'

interface CacheEntry {
  config: client.Configuration
  fetchedAt: number
}

// Discovery documents don't change often — cache per issuer instead of
// hitting .well-known/openid-configuration on every sign-in. Same
// in-memory-Map-with-TTL shape already used in src/lib/rate-limit.ts.
const DISCOVERY_TTL_MS = 60 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export interface SsoConfigRow {
  issuer: string
  clientId: string
  clientSecretEnc: string
}

/** Validates the issuer looks like a real URL before we ever fetch it — an
 * admin-saved value should fail loudly at save time too, but this is the
 * last line of defense against a malformed/malicious issuer. */
export function isValidIssuer(issuer: string): boolean {
  try {
    const url = new URL(issuer)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function getOidcClient(row: SsoConfigRow): Promise<client.Configuration> {
  const cached = cache.get(row.issuer)
  if (cached && Date.now() - cached.fetchedAt < DISCOVERY_TTL_MS) {
    return cached.config
  }

  if (!isValidIssuer(row.issuer)) throw new Error(`Invalid SSO issuer: ${row.issuer}`)

  const clientSecret = decryptSecret(row.clientSecretEnc)
  const config = await client.discovery(new URL(row.issuer), row.clientId, clientSecret)

  cache.set(row.issuer, { config, fetchedAt: Date.now() })
  return config
}
