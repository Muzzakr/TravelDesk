interface WelcomeTemplateProps {
  email: string
}

export function welcomeTemplate({ email }: WelcomeTemplateProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to our Newsletter</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:#4f46e5;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Newsletter</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Welcome aboard! 🎉</h2>
              <p style="margin:0 0 16px;color:#6b7280;font-size:16px;line-height:1.6;">
                Hi there! You've successfully subscribed with <strong>${email}</strong>.
                We're excited to have you with us.
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:16px;line-height:1.6;">
                Expect curated content, tips, and updates delivered to your inbox every week.
              </p>
              <a href="#" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                View Latest Issue
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:13px;">
                Don't want these emails? <a href="#" style="color:#4f46e5;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
