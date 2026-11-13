(async () => {
  const moduleUrl = '/src/utils/safeReturnTo.ts';
  const response = await fetch(moduleUrl);
  const { safeReturnTo } = await import(moduleUrl);
  const cases = [
    [null, '/'], ['', '/'], ['/', '/'], ['/history', '/history'],
    ['/report/qa-1793778867-main?payment=success&session_id=qa#details', '/report/qa-1793778867-main?payment=success&session_id=qa#details'],
    ['//evil.invalid', '/'], ['///evil.invalid', '/'], ['/\\evil.invalid', '/'], ['\\evil.invalid', '/'],
    ['/report\\evil.invalid', '/'], ['https://evil.invalid', '/'], ['http://evil.invalid', '/'],
    ['javascript:alert(1)', '/'], ['data:text/html,hello', '/'], ['/https://evil.invalid', '/'],
    ['/\tevil.invalid', '/'], ['/\nevil.invalid', '/'], ['/\revil.invalid', '/'],
    ['/%2fevil.invalid', '/'], ['/%5cevil.invalid', '/'], ['/%255cevil.invalid', '/'],
    ['/a/..//evil.invalid', '/'], ['/a/%2e%2e//evil.invalid', '/'], [' /history', '/'],
    ['/history?returnTo=https://evil.invalid', '/'], ['/report/qa-test?tab=photos#room', '/report/qa-test?tab=photos#room'],
  ];
  const results = cases.map(([input, expected]) => {
    // Match the login page's URLSearchParams decoding exactly.
    const search = input === null ? '' : '?returnTo=' + encodeURIComponent(input);
    const output = safeReturnTo(new URLSearchParams(search).get('returnTo'));
    return { input, expected, output, pass: output === expected };
  });
  return {
    test: 'Real preview browser executes the exact returnTo module used by LoginPage; no mocked login or QA session',
    origin: location.origin,
    status: response.status,
    serverRequestId: response.headers.get('x-request-id'),
    requestIdNote: 'Vite does not emit request IDs; browser resource timing entry identifies the real request',
    resource: performance.getEntriesByType('resource').filter(e => e.name.endsWith(moduleUrl)).map(e => ({ name: e.name, startTime: e.startTime, duration: e.duration })),
    passed: results.filter(r => r.pass).length, total: results.length, results,
    loginFormVisible: !!document.querySelector('input[type="password"]'),
    timeUTC: new Date().toISOString(),
  };
})()
