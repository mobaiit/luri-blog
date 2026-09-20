const encoder = new TextEncoder();
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2, '0')).join('');
export const hash = async (value) => {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, '0')).join('');
};
const PASSWORD_HASH_VERSION = 'v2';
const PASSWORD_ITERATIONS = 10000;
export const passwordHash = async (password, salt = token(), iterations = PASSWORD_ITERATIONS) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  // A free-plan Worker has a 10 ms CPU cap.  Keep this safely below it and
  // retain the work factor in the value so it can be raised later.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' }, key, 256);
  return `${PASSWORD_HASH_VERSION}:${iterations}:${salt}:${[...new Uint8Array(bits)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
};
export const verifyPassword = async (password, stored) => {
  const parts = String(stored).split(':');
  const [salt, expected, iterations] = parts[0] === PASSWORD_HASH_VERSION
    ? [parts[2], parts[3], Number(parts[1])]
    // Compatibility with credentials written by the first implementation.
    : [parts[0], parts[1], 50000];
  if (!salt || !expected) return false;
  const actual = await passwordHash(password, salt, Number.isSafeInteger(iterations) && iterations > 0 ? iterations : PASSWORD_ITERATIONS);
  return actual.split(':').at(-1) === expected;
};
export const cookie = (request, name) => Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => part.trim().split('=')))[name];
export const sessionCookie = (name, value, seconds) => `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${seconds}`;
export async function verifyTurnstile(value, env, request) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!value) return false;
  try {
    const form = new FormData(); form.set('secret', env.TURNSTILE_SECRET_KEY); form.set('response', value); form.set('remoteip', request.headers.get('CF-Connecting-IP') || '');
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    if (!response.ok) return false;
    return Boolean((await response.json()).success);
  } catch (error) {
    console.error('Turnstile verification failed', error);
    return false;
  }
}
