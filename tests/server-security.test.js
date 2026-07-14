import test from 'node:test';
import assert from 'node:assert/strict';
import {FixedWindowRateLimiter, hasCsrfHeader, isAuthenticated, isPathInsideRoots, isRequestAllowed, validateExposureConfig} from '../src/lib/server-security.js';

test('server allows same-origin localhost mutations', () => {
  assert.equal(isRequestAllowed({host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', secFetchSite: 'same-origin'}), true);
});

test('remote exposure requires a strong token while localhost remains optional', () => {
  assert.deepEqual(validateExposureConfig({host: '127.0.0.1'}), {remote: false, protected: false});
  assert.throws(() => validateExposureConfig({host: '0.0.0.0', authToken: 'short'}), /24 caracteres/);
  assert.deepEqual(validateExposureConfig({host: '0.0.0.0', authToken: 'a'.repeat(24)}), {remote: true, protected: true});
});

test('authentication accepts bearer/basic secrets and csrf is explicit', () => {
  const token = 'safe-token-123456789012345';
  assert.equal(isAuthenticated(`Bearer ${token}`, token), true);
  assert.equal(isAuthenticated(`Basic ${Buffer.from(`shortsmith:${token}`).toString('base64')}`, token), true);
  assert.equal(isAuthenticated('Bearer wrong', token), false);
  assert.equal(hasCsrfHeader({'x-shortsmith-csrf': '1'}), true);
  assert.equal(hasCsrfHeader({}), false);
});

test('rate limiter resets its fixed window', () => {
  const limiter = new FixedWindowRateLimiter({limit: 2, windowMs: 1000});
  assert.equal(limiter.consume('client', 0).allowed, true);
  assert.equal(limiter.consume('client', 1).allowed, true);
  assert.equal(limiter.consume('client', 2).allowed, false);
  assert.equal(limiter.consume('client', 1000).allowed, true);
});

test('server rejects cross-site and DNS rebinding hosts', () => {
  assert.equal(isRequestAllowed({host: '127.0.0.1:3000', origin: 'https://evil.example', secFetchSite: 'cross-site'}), false);
  assert.equal(isRequestAllowed({host: 'evil.example', origin: 'https://evil.example', secFetchSite: 'same-origin'}), false);
});

test('server accepts explicitly configured proxy host and origin', () => {
  assert.equal(isRequestAllowed({
    host: 'studio.example:8443', origin: 'https://studio.example:8443', secFetchSite: 'same-origin',
    allowedHosts: 'studio.example', allowedOrigins: 'https://studio.example:8443'
  }), true);
});

test('remote media roots allow descendants and reject sibling-prefix escapes', () => {
  assert.equal(isPathInsideRoots('D:\\media\\channel\\video.mp4', ['D:\\media']), true);
  assert.equal(isPathInsideRoots('D:\\media', ['D:\\media']), true);
  assert.equal(isPathInsideRoots('D:\\media-private\\video.mp4', ['D:\\media']), false);
  assert.equal(isPathInsideRoots('D:\\other\\video.mp4', []), false);
});
