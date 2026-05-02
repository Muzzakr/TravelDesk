import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewsletterForm } from '@/components/newsletter/NewsletterForm'

global.fetch = jest.fn()

describe('NewsletterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the email input and submit button', () => {
    render(<NewsletterForm />)
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument()
  })

  it('shows success message after successful subscription', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Subscribed successfully' }),
    })

    render(<NewsletterForm />)
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))

    await waitFor(() => {
      expect(screen.getByText(/subscribed/i)).toBeInTheDocument()
    })
  })

  it('shows error message when subscription fails', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Already subscribed' }),
    })

    render(<NewsletterForm />)
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'existing@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))

    await waitFor(() => {
      expect(screen.getByText(/already subscribed/i)).toBeInTheDocument()
    })
  })
})
