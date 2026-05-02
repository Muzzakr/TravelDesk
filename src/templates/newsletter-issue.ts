interface NewsletterIssueProps {
  title: string
  previewText: string
  content: string
  issueNumber: number
  unsubscribeUrl: string
}

export function newsletterIssueTemplate({
  title,
  previewText,
  content,
  issueNumber,
  unsubscribeUrl,
}: NewsletterIssueProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="x-apple-disable-message-reformatting"/>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:#4f46e5;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Newsletter</h1>
              <span style="color:#c7d2fe;font-size:13px;">Issue #${issueNumber}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 24px;color:#111827;font-size:24px;">${title}</h2>
              <div style="color:#374151;font-size:16px;line-height:1.7;">
                ${content}
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:13px;">
                You're receiving this because you subscribed to our newsletter.<br/>
                <a href="${unsubscribeUrl}" style="color:#4f46e5;">Unsubscribe</a>
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
