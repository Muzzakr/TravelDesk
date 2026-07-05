// Rate limiter for auth endpoints.
//
// Uses Upstash Redis (fixed window via INCR + PEXPIRE) when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set — shared state
// across all serverless instances, i.e. a hard limit. Falls back to a
// per-instance in-memory window when the env vars are missing, which still
// raises the cost of brute force but resets on cold starts.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k)
  }
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

async function redisLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', `rl:${key}`],
      ['PEXPIRE', `rl:${key}`, windowMs, 'NX'],
    ]),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as { result: number }[]
  return Number(data[0]?.result ?? 0) <= limit
}

/** Returns true if the call is allowed, false if the key is over its limit. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      return await redisLimit(key, limit, windowMs)
    } catch (err) {
      console.error('Rate limiter: Redis unavailable, falling back to memory:', err)
    }
  }
  return memoryLimit(key, limit, windowMs)
}

/** Best-effort client IP for keying (behind Vercel's proxy). */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}
