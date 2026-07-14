export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api(path, options = {}, responseType = 'json') {
  const controller = new AbortController();
  const {timeout: timeoutMs = 30_000, signal, ...requestOptions} = options;
  const relayAbort = () => controller.abort(signal.reason);
  if (signal?.aborted) relayAbort(); else signal?.addEventListener('abort', relayAbort, {once: true});
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const method = String(requestOptions.method || 'GET').toUpperCase();
    const headers = new Headers(requestOptions.headers || {});
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('x-shortsmith-csrf', '1');
    const response = await fetch(path, {...requestOptions, headers, signal: controller.signal});
    const payload = responseType === 'text' ? await response.text() : await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(payload?.error || payload || `Error HTTP ${response.status}`, response.status, payload?.code);
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (signal?.aborted) throw new ApiError('Operación cancelada.', 0, 'ABORTED');
      throw new ApiError('La operación tardó demasiado. Shortsmith seguirá conservando el estado del trabajo.', 0, 'TIMEOUT');
    }
    throw new ApiError('No se pudo conectar con el servidor local.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', relayAbort);
  }
}

export function uploadForm(path, data, {signal, onProgress, timeout = 0} = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let timeoutId = null;
    request.open('POST', path);
    request.setRequestHeader('x-shortsmith-csrf', '1');
    request.responseType = 'json';
    if (timeout > 0) timeoutId = setTimeout(() => request.abort(), timeout);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.({loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100)});
    });
    request.addEventListener('load', () => {
      if (timeoutId) clearTimeout(timeoutId);
      const payload = request.response || {};
      if (request.status >= 200 && request.status < 300) resolve(payload);
      else reject(new ApiError(payload.error || `Error HTTP ${request.status}`, request.status));
    });
    request.addEventListener('error', () => reject(new ApiError('La subida perdió la conexión con Shortsmith.', 0, 'NETWORK_ERROR')));
    request.addEventListener('abort', () => reject(new ApiError('Subida cancelada.', 0, 'ABORTED')));
    const abort = () => request.abort();
    signal?.addEventListener('abort', abort, {once: true});
    request.addEventListener('loadend', () => signal?.removeEventListener('abort', abort));
    request.send(data);
  });
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function platformLabel(platform) {
  return {youtube: 'YouTube Shorts', instagram: 'Instagram Reels', tiktok: 'TikTok', x: 'X'}[platform] || platform;
}
