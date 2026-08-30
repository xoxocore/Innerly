/**
 * The wrapper every marketing email goes out in.
 *
 * Shared by the composer's preview and by the server that actually sends, so
 * the preview is the email rather than a drawing of one.
 *
 * Written the way email has to be written rather than the way the web is:
 * inline styles, a table for the frame, no external stylesheet and no web
 * font. Outlook and Gmail between them ignore most of what a browser does.
 */

export type EmailParts = {
  subject: string;
  /** The grey line under the subject in an inbox list. */
  preheader?: string;
  /** Rich text from the editor. */
  body: string;
  name?: string;
  /** Where the unsubscribe link goes. */
  unsubscribeUrl: string;
};

const GREEN = "#00874a";
const INK = "#14201a";
const MUTED = "#5d6b64";
const LINE = "#e2e8e5";

export function fillName(text: string, name: string | undefined) {
  return text.replace(/\{name\}/g, (name ?? "").trim() || "there");
}

export function renderEmail({
  subject,
  preheader,
  body,
  name,
  unsubscribeUrl,
}: EmailParts): string {
  const safeBody = fillName(body, name);
  const safeSubject = fillName(subject, name);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(safeSubject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f5;">
<!-- Shown in the inbox list beside the subject, and nowhere else. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${escapeHtml(fillName(preheader ?? "", name))}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#f4f7f5;padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:560px;background:#ffffff;border:1px solid ${LINE};
                  border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <span style="display:inline-block;font:600 20px/1 -apple-system,BlinkMacSystemFont,
                     'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${GREEN};
                     letter-spacing:-0.01em;">innerly</span>
      </td></tr>

      <tr><td style="padding:22px 32px 8px;">
        <h1 style="margin:0;font:500 22px/1.3 -apple-system,BlinkMacSystemFont,
                   'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};
                   letter-spacing:-0.015em;">${escapeHtml(safeSubject)}</h1>
      </td></tr>

      <tr><td style="padding:4px 32px 28px;font:400 15px/1.65 -apple-system,
                     BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                     color:${INK};">
        ${safeBody || "<p></p>"}
      </td></tr>

      <tr><td style="padding:0 32px 28px;">
        <div style="border-top:1px solid ${LINE};padding-top:18px;
                    font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',
                    Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
          You're getting this because you have an Innerly account.
          <a href="${unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">
            Stop these emails</a> — you'll still get anything to do with your
          account, like a password reset.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** The same message as plain text, for clients that will not render HTML. */
export function renderPlain(parts: EmailParts): string {
  const text = fillName(parts.body, parts.name)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `${fillName(parts.subject, parts.name)}

${text}

—
You're getting this because you have an Innerly account.
Stop these emails: ${parts.unsubscribeUrl}
You'll still get anything to do with your account, like a password reset.`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
