/** Return a local absolute path only; never reinterpret an untrusted URL as a host. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  // Reject browser URL-normalisation tricks, schemes, and encoded separators.
  // URLSearchParams has already decoded the outer query parameter once.
  if (/[\\\u0000-\u0020\u007f]/.test(value) || /[a-z][a-z0-9+.-]*:/i.test(value)) return '/';
  if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20|25|7f)/i.test(value)) return '/';
  try {
    const base = 'https://local.invalid';
    const parsed = new URL(value, base);
    if (parsed.origin !== base || parsed.username || parsed.password) return '/';
    // Dot segments can normalize /path/..//host into //host. Reject that too.
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}
