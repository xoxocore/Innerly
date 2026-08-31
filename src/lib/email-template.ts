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
  /**
   * A complete HTML document, designed somewhere else and pasted in whole.
   * When present the body and the frame below are not used — the only thing
   * added is the unsubscribe footer, which is not optional.
   */
  customHtml?: string | null;
};

const GREEN = "#00874a";
const INK = "#14201a";
const MUTED = "#5d6b64";
const LINE = "#e2e8e5";

/** The frame's inner width. Every image is held to it. */
const WIDTH = 560;
const INNER = WIDTH - 64;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function fillName(text: string, name: string | undefined) {
  return text.replace(/\{name\}/g, (name ?? "").trim() || "there");
}

/**
 * Emails cannot be laid out with a stylesheet, so every element the editor
 * produces has to carry its own styling before it is sent.
 *
 * The picture rule is the one that matters most: an <img> with no width in an
 * email renders at its own pixel size, which for a phone photo means a 4000px
 * image bursting out of a 560px frame. Gmail strips `max-width` from a style
 * attribute in some clients, so the width attribute is set as well — belt and
 * braces, because there is no way to test every inbox.
 */
function styleForEmail(html: string): string {
  return (
    html
      // Pictures: held to the frame, and never taller than a screenful.
      .replace(
        /<img\b([^>]*?)\/?>/gi,
        (_m, attrs: string) =>
          `<img${stripAttr(attrs, ["width", "height", "style"])} width="${INNER}" ` +
          `style="display:block;width:100%;max-width:${INNER}px;height:auto;` +
          `border-radius:10px;border:0;outline:none;text-decoration:none;" />`
      )
      .replace(
        /<figure\b[^>]*>/gi,
        `<figure style="margin:22px 0;padding:0;">`
      )
      .replace(
        /<figcaption\b[^>]*>/gi,
        `<figcaption style="margin-top:8px;font:400 12.5px/1.5 ${FONT};color:${MUTED};">`
      )
      .replace(/<p\b[^>]*>/gi, `<p style="margin:0 0 15px;">`)
      .replace(
        /<h2\b[^>]*>/gi,
        `<h2 style="margin:26px 0 10px;font:600 18px/1.35 ${FONT};color:${INK};letter-spacing:-0.01em;">`
      )
      .replace(
        /<h3\b[^>]*>/gi,
        `<h3 style="margin:22px 0 8px;font:600 15.5px/1.4 ${FONT};color:${INK};">`
      )
      .replace(
        /<blockquote\b[^>]*>/gi,
        `<blockquote style="margin:20px 0;padding:2px 0 2px 16px;border-left:3px solid ${GREEN};color:${MUTED};font-style:italic;">`
      )
      .replace(/<ul\b[^>]*>/gi, `<ul style="margin:0 0 15px;padding-left:22px;">`)
      .replace(/<ol\b[^>]*>/gi, `<ol style="margin:0 0 15px;padding-left:22px;">`)
      .replace(/<li\b[^>]*>/gi, `<li style="margin:0 0 7px;">`)
      .replace(
        /<hr\b[^>]*\/?>/gi,
        `<hr style="border:0;border-top:1px solid ${LINE};margin:26px 0;" />`
      )
      // Links that are not already a button.
      .replace(
        /<a\b(?![^>]*data-cta)([^>]*?)>/gi,
        (_m, attrs: string) =>
          `<a${attrs} style="color:${GREEN};text-decoration:underline;">`
      )
      // The call to action, rendered as a real button. A bordered table cell
      // rather than a styled <a>, because Outlook does not paint padding or a
      // background on an inline element.
      .replace(
        /<a\b([^>]*?)data-cta[^>]*?href="([^"]*)"([^>]*?)>(.*?)<\/a>/gi,
        (_m, _a: string, href: string, _b: string, label: string) => ctaButton(href, label)
      )
      .replace(
        /<a\b([^>]*?)href="([^"]*)"([^>]*?)data-cta[^>]*?>(.*?)<\/a>/gi,
        (_m, _a: string, href: string, _b: string, label: string) => ctaButton(href, label)
      )
  );
}

function ctaButton(href: string, label: string): string {
  const text = label.replace(/<[^>]+>/g, "").trim() || "Open Innerly";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center" bgcolor="${GREEN}" style="border-radius:999px;">
    <a href="${href}" style="display:inline-block;padding:13px 30px;font:600 14px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(text)}</a>
  </td></tr>
</table>`;
}

/** Drop attributes we are about to set ourselves, so they cannot be doubled. */
function stripAttr(attrs: string, names: string[]): string {
  let out = attrs;
  for (const n of names) {
    out = out.replace(new RegExp(`\\s${n}\\s*=\\s*"[^"]*"`, "gi"), "");
    out = out.replace(new RegExp(`\\s${n}\\s*=\\s*'[^']*'`, "gi"), "");
  }
  return out;
}

export function renderEmail({
  subject,
  preheader,
  body,
  name,
  unsubscribeUrl,
  customHtml,
}: EmailParts): string {
  const safeSubject = fillName(subject, name);

  // A design brought in from elsewhere is used as it is. The unsubscribe line
  // is still appended, because it is a legal requirement rather than a
  // decision the designer gets to make.
  if (customHtml && customHtml.trim()) {
    return withFooter(fillName(customHtml, name), unsubscribeUrl);
  }

  const safeBody = styleForEmail(fillName(body, name));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(safeSubject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f5;">
<!-- Shown in the inbox list beside the subject, and nowhere else. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${escapeHtml(fillName(preheader ?? "", name))}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#f4f7f5;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:${WIDTH}px;background:#ffffff;border:1px solid ${LINE};
                  border-radius:16px;overflow:hidden;">

      <tr><td style="padding:26px 32px 0;">
        <span style="display:inline-block;font:600 19px/1 ${FONT};color:${GREEN};
                     letter-spacing:-0.01em;">innerly</span>
      </td></tr>

      <tr><td style="padding:20px 32px 6px;">
        <h1 style="margin:0;font:500 23px/1.28 ${FONT};color:${INK};
                   letter-spacing:-0.015em;">${escapeHtml(safeSubject)}</h1>
      </td></tr>

      <tr><td style="padding:8px 32px 30px;font:400 15px/1.65 ${FONT};color:${INK};">
        ${safeBody || "<p></p>"}
      </td></tr>

      <tr><td style="padding:0 32px 28px;">
        <div style="border-top:1px solid ${LINE};padding-top:18px;
                    font:400 12px/1.6 ${FONT};color:${MUTED};">
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

/** Puts the unsubscribe line at the end of a design brought in from elsewhere. */
function withFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5;">
  <tr><td align="center" style="padding:22px 16px 34px;">
    <div style="max-width:${WIDTH}px;font:400 12px/1.6 ${FONT};color:${MUTED};text-align:center;">
      You're getting this because you have an Innerly account.
      <a href="${unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Stop these emails</a>
      — you'll still get anything to do with your account, like a password reset.
    </div>
  </td></tr>
</table>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}\n</body>`);
  }
  return html + footer;
}

/** The same message as plain text, for clients that will not render HTML. */
export function renderPlain(parts: EmailParts): string {
  const source = parts.customHtml?.trim() ? parts.customHtml : parts.body;
  const text = fillName(source, parts.name)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote|tr|div)>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
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
