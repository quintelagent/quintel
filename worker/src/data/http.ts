export async function getJson<T>(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'user-agent': 'quintel-engine/1.0', ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Try adapters in order; return first success plus errors seen. */
export async function firstOk<T>(fns: [string, () => Promise<T>][]): Promise<{ value: T; source: string; errors: string[] }> {
  const errors: string[] = [];
  for (const [name, fn] of fns) {
    try {
      return { value: await fn(), source: name, errors };
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }
  throw new Error('all adapters failed: ' + errors.join('; '));
}
