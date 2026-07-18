function buildEmailTemplate({ title, subtitle, content, buttonText, buttonUrl }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f7fb; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fb; padding:30px 0;">
          <tr>
            <td align="center">
              <table width="650" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 24px rgba(15,45,107,0.12);">
                
                <tr>
                  <td style="background:#0f2d6b; padding:28px; text-align:center;">
                    <img 
                      src="https://authtrackpro.com/logo.png" 
                      alt="AuthTrack Pro Logo" 
                      style="max-width:190px; margin-bottom:12px;" 
                    />
                    <h1 style="color:#ffffff; margin:0; font-size:24px;">${title}</h1>
                    ${
                      subtitle
                        ? `<p style="color:#dbeafe; margin:8px 0 0; font-size:15px;">${subtitle}</p>`
                        : ""
                    }
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px;">
                    ${content}

                    ${
                      buttonText && buttonUrl
                        ? `
                          <div style="text-align:center; margin:30px 0;">
                            <a href="${buttonUrl}" 
                              style="background:#0f2d6b; color:#ffffff; text-decoration:none; padding:14px 24px; border-radius:8px; display:inline-block; font-weight:bold;">
                              ${buttonText}
                            </a>
                          </div>
                        `
                        : ""
                    }
                  </td>
                </tr>

                <tr>
                  <td style="background:#eef3fb; padding:24px 30px; text-align:center;">
                    <p style="margin:0; font-size:15px; font-weight:bold; color:#0f2d6b;">
                      AuthTrack Pro
                    </p>
                    <p style="margin:6px 0; font-size:13px; color:#4b5563;">
                      Simplifying Prior Authorization Management
                    </p>
                    <p style="margin:6px 0; font-size:13px;">
                      <a href="mailto:info@authtrackpro.com" style="color:#0f2d6b;">info@authtrackpro.com</a> |
                      <a href="https://www.authtrackpro.com" style="color:#0f2d6b;">www.authtrackpro.com</a>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 30px; background:#ffffff;">
                    <p style="font-size:11px; line-height:1.5; color:#6b7280;">
                      <strong>Confidentiality Notice:</strong> This email and any attachments are intended solely for the individual or organization to whom they are addressed and may contain confidential or proprietary information. If you are not the intended recipient, any review, use, disclosure, distribution, or copying of this communication is strictly prohibited. If you received this email in error, please notify the sender immediately and permanently delete it from your system.
                    </p>

                    <p style="font-size:11px; line-height:1.5; color:#6b7280;">
                      <strong>HIPAA Notice:</strong> AuthTrack Pro is designed to support prior authorization workflows. Unless otherwise specified under a signed Business Associate Agreement, do not include protected health information or sensitive patient data in replies to this email or in demo requests. Patient-specific information should only be shared through approved secure channels.
                    </p>

                    <p style="font-size:11px; line-height:1.5; color:#6b7280;">
                      <strong>Security Notice:</strong> AuthTrack Pro will never request passwords, verification codes, or financial information by email. If you receive a suspicious message claiming to be from AuthTrack Pro, contact us directly at info@authtrackpro.com before responding.
                    </p>

                    <p style="font-size:11px; line-height:1.5; color:#9ca3af; text-align:center;">
                      © 2026 AuthTrack Pro. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

module.exports = buildEmailTemplate;