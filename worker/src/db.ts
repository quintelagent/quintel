import type { Env } from './config';

export async function getMeta<T>(env: Env, key: string): Promise<T | null> {
  const r = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>();
  return r ? (JSON.parse(r.value) as T) : null;
}

export async function setMeta(env: Env, key: string, value: unknown) {
  await env.DB.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, JSON.stringify(value)).run();
}

export async function incr(env: Env, key: string, by = 1) {
  await env.DB.prepare('INSERT INTO counters (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value')
    .bind(key, by).run();
}

export async function counter(env: Env, key: string): Promise<number> {
  const r = await env.DB.prepare('SELECT value FROM counters WHERE key = ?').bind(key).first<{ value: number }>();
  return r?.value ?? 0;
}
