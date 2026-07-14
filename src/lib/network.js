export function abortError(signal, message = 'Operación cancelada.') {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException(message, 'AbortError');
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

export function abortableSleep(ms, signal) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, Math.max(0, Number(ms) || 0));
    function cleanup() {
      signal?.removeEventListener('abort', cancelled);
    }
    function done() {
      cleanup();
      resolve();
    }
    function cancelled() {
      clearTimeout(timer);
      cleanup();
      reject(abortError(signal));
    }
    signal?.addEventListener('abort', cancelled, {once: true});
  });
}

export async function fetchWithTimeout(url, init = {}, options = {}) {
  const timeoutMs = Math.max(1, Number(options.timeoutMs ?? 30_000));
  const externalSignal = options.signal ?? init.signal;
  throwIfAborted(externalSignal);
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = externalSignal ? AbortSignal.any([externalSignal, timeout]) : timeout;
  try {
    return await (options.fetchImpl ?? globalThis.fetch)(url, {...init, signal});
  } catch (error) {
    if (externalSignal?.aborted) throw abortError(externalSignal);
    if (timeout.aborted) {
      const timeoutError = new Error(`La petición superó ${Math.round(timeoutMs / 1000)} segundos.`);
      timeoutError.name = 'TimeoutError';
      timeoutError.retryable = true;
      throw timeoutError;
    }
    throw error;
  }
}

export function retryDelay(attempt, {baseMs = 500, maxMs = 30_000, jitter = 0.25} = {}) {
  const exponential = Math.min(maxMs, baseMs * (2 ** Math.max(0, attempt)));
  return exponential + Math.floor(Math.random() * Math.max(1, exponential * jitter));
}
