-- Innerly: bringing a design in from somewhere else.
--
-- Run after 0009. Safe to run more than once.
--
-- Innerly's own composer covers the ordinary newsletter, but a designed one —
-- laid out in Canva, Beefree, Stripo, anything that exports HTML — is a whole
-- document rather than a body to be wrapped. Kept in its own column so the two
-- never overwrite each other: switching to a pasted design and back leaves the
-- written version exactly as it was.

alter table public.email_campaigns
  add column if not exists custom_html text;

comment on column public.email_campaigns.custom_html is
  'A complete HTML email pasted in from a designer. When set, it is sent as-is '
  'and only the unsubscribe footer is appended. Null means use body + Innerly''s frame.';
