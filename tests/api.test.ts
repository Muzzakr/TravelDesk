import { subscribe, unsubscribe } from '@/lib/api'

global.fetch = jest.fn()

describe('api.ts', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('subscribe', () => {
    it('returns success when API call succeeds', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Subscribed successfully' }),
      })

      const result = await subscribe('test@example.com')
      expect(result.success).toBe(true)
    })

    it('returns error when API call fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Already subscribed' }),
      })

      const result = await subscribe('test@example.com')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Already subscribed')
    })

    it('handles network errors', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await subscribe('test@example.com')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('unsubscribe', () => {
    it('returns success when unsubscription succeeds', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Unsubscribed' }),
      })

      const result = await unsubscribe('test@example.com')
      expect(result.success).toBe(true)
    })
  })
})
