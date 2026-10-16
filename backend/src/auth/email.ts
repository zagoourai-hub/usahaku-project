// Gmail ignores dots and treats googlemail.com as gmail.com.
const GMAIL = new Set(['gmail.com', 'googlemail.com']);

// Well-known throwaway inboxes. Not exhaustive: it raises the cost of mass
// signups, the per-IP cap and canonical email do the rest.
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  'discard.email',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

/** Same mailbox, same string: lowercase, drop `+tag`, and gmail dots. */
export function canonicalEmail(email: string): string {
  const at = email.lastIndexOf('@');
  let local = email.slice(0, at).toLowerCase();
  let domain = email.slice(at + 1).toLowerCase();
  local = local.split('+')[0];
  if (GMAIL.has(domain)) {
    local = local.replaceAll('.', '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}
