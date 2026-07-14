import {timingSafeEqual} from 'node:crypto';
import path from 'node:path';

export function isLoopbackAddress(value = '') {
  const host = String(value).trim().toLowerCase().replace(/^\[|\]$/g, '');
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthenticated(authorization = '', expectedToken = '') {
  if (!expectedToken) return true;
  const value = String(authorization || '');
  if (/^Bearer\s+/i.test(value)) return safeEqual(value.replace(/^Bearer\s+/i, ''), expectedToken);
  if (/^Basic\s+/i.test(value)) {
    try {
      const decoded = Buffer.from(value.replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      return separator >= 0 && safeEqual(decoded.slice(separator + 1), expectedToken);
    } catch {
      return false;
    }
  }
  return false;
}

export function validateExposureConfig({host = '127.0.0.1', authToken = ''} = {}) {
  if (isLoopbackAddress(host)) return {remote: false, protected: Boolean(authToken)};
  if (String(authToken).length < 24) {
    throw new Error('Para escuchar fuera de localhost configura SHORTSMITH_AUTH_TOKEN con al menos 24 caracteres y usa HTTPS en el proxy.');
  }
  return {remote: true, protected: true};
}

export function hasCsrfHeader(headers = {}) {
  return String(headers['x-shortsmith-csrf'] || '').toLowerCase() === '1';
}

export function isPathInsideRoots(candidate, roots = []) {
  const resolvedCandidate = path.resolve(String(candidate || ''));
  return roots.some((root) => {
    const resolvedRoot = path.resolve(String(root || ''));
    const relative = path.relative(resolvedRoot, resolvedCandidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
}

export class FixedWindowRateLimiter {
  constructor({limit = 120, windowMs = 60_000} = {}) {
    this.limit = Math.max(1, Number(limit) || 120);
    this.windowMs = Math.max(1000, Number(windowMs) || 60_000);
    this.entries = new Map();
  }

  consume(key, now = Date.now()) {
    const id = String(key || 'unknown');
    let entry = this.entries.get(id);
    if (!entry || now >= entry.resetAt) entry = {count: 0, resetAt: now + this.windowMs};
    entry.count += 1;
    this.entries.set(id, entry);
    if (this.entries.size > 2000) {
      for (const [storedKey, stored] of this.entries) if (now >= stored.resetAt) this.entries.delete(storedKey);
    }
    return {allowed: entry.count <= this.limit, remaining: Math.max(0, this.limit - entry.count), resetAt: entry.resetAt};
  }
}

export function securityHeaders({contentType = '', cache = false} = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'cross-origin-opener-policy': 'same-origin',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    ...(contentType ? {'content-type': contentType} : {}),
    ...(cache ? {'cache-control': 'public, max-age=300'} : {'cache-control': 'no-store'})
  };
}

export function isRequestAllowed({host = '', origin = '', secFetchSite = '', allowedHosts = '', allowedOrigins = ''} = {}) {
  const normalizedHost = String(host).toLowerCase();
  let hostname = '';
  try {
    hostname = new URL(`http://${normalizedHost}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  const hostAllowlist = new Set([
    '127.0.0.1', 'localhost', '::1',
    ...String(allowedHosts).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  ]);
  if (!hostAllowlist.has(hostname)) return false;
  const originAllowlist = new Set([
    `http://${normalizedHost}`,
    `https://${normalizedHost}`,
    ...String(allowedOrigins).split(',').map((value) => value.trim()).filter(Boolean)
  ]);
  if (origin && !originAllowlist.has(origin)) return false;
  return secFetchSite !== 'cross-site';
}
