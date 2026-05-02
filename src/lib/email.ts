import sgMail from '@sendgrid/mail'
import { welcomeTemplate } from '@/templates/welcome'

sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? '')

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'newsletter@example.com'

export async function sendWelcomeEmail(to: string): Promise<void> {
  const msg = {
    to,
    from: FROM_EMAIL,
    subject: 'Welcome to our Newsletter!',
    html: welcomeTemplate({ email: to }),
  }

  await sgMail.send(msg)
}

export async function sendNewsletterIssue(
  to: string[],
  subject: string,
  html: string
): Promise<void> {
  const messages = to.map((email) => ({
    to: email,
    from: FROM_EMAIL,
    subject,
    html,
  }))

  await sgMail.send(messages)
}
