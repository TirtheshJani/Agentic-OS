/**
 * Resource factory — collapses the boilerplate of one-file-per-domain API
 * wrappers into a single call.
 *
 * Example:
 *   const tasks = defineResource<Task, TaskList>({
 *     base: '/api/tasks',
 *     keys: ['tasks'],
 *   });
 *   tasks.list();           // GET    /api/tasks
 *   tasks.get('abc');       // GET    /api/tasks/abc
 *   tasks.create({...});    // POST   /api/tasks
 *   tasks.update('abc', x); // PATCH  /api/tasks/abc
 *   tasks.remove('abc');    // DELETE /api/tasks/abc
 *   tasks.keys.list();      // ['tasks', 'list']
 */
import { apiFetch } from './client';

export interface ResourceConfig {
  base: string;
  keys: readonly (string | number)[];
}

export interface Resource<TItem, TList = TItem[]> {
  base: string;
  keys: {
    all: readonly (string | number)[];
    list: () => readonly (string | number)[];
    detail: (id: string | number) => readonly (string | number)[];
  };
  list: (query?: Record<string, string | number | boolean | undefined>) => Promise<TList>;
  get: (id: string | number) => Promise<TItem>;
  create: <TBody = unknown>(body: TBody) => Promise<TItem>;
  update: <TBody = unknown>(id: string | number, body: TBody) => Promise<TItem>;
  remove: (id: string | number) => Promise<void>;
}

function qs(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function defineResource<TItem, TList = TItem[]>(
  config: ResourceConfig
): Resource<TItem, TList> {
  const { base, keys: keyParts } = config;
  const url = (id?: string | number) => (id == null ? base : `${base}/${encodeURIComponent(id)}`);

  return {
    base,
    keys: {
      all: keyParts,
      list: () => [...keyParts, 'list'] as const,
      detail: (id: string | number) => [...keyParts, 'detail', id] as const,
    },
    list: (query) => apiFetch<TList>(`${base}${qs(query)}`),
    get: (id) => apiFetch<TItem>(url(id)),
    create: <TBody = unknown>(body: TBody) =>
      apiFetch<TItem>(base, { method: 'POST', body: JSON.stringify(body) }),
    update: <TBody = unknown>(id: string | number, body: TBody) =>
      apiFetch<TItem>(url(id), { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id) => apiFetch<void>(url(id), { method: 'DELETE' }),
  };
}
