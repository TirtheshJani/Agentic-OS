/**
 * Default MSW handlers.
 *
 * Phase 1 ships a single example handler that matches the resource factory's
 * URL conventions. As routes migrate onto `defineResource`, add per-resource
 * handler factories here so tests get realistic shapes for free.
 */
import { HttpResponse, http } from 'msw';

export const handlers = [
  http.get('/api/_ping', () => HttpResponse.json({ ok: true })),
];

/**
 * Helper that generates the five standard handlers (list/get/create/update/
 * delete) for a resource defined via `defineResource`.
 */
export function resourceHandlers<TItem extends { id: string | number }>(
  base: string,
  store: TItem[]
) {
  return [
    http.get(base, () => HttpResponse.json(store)),
    http.get(`${base}/:id`, ({ params }) => {
      const found = store.find((it) => String(it.id) === String(params.id));
      return found ? HttpResponse.json(found) : new HttpResponse(null, { status: 404 });
    }),
    http.post(base, async ({ request }) => {
      const body = (await request.json()) as TItem;
      store.push(body);
      return HttpResponse.json(body, { status: 201 });
    }),
    http.patch(`${base}/:id`, async ({ params, request }) => {
      const patch = (await request.json()) as Partial<TItem>;
      const idx = store.findIndex((it) => String(it.id) === String(params.id));
      if (idx < 0) return new HttpResponse(null, { status: 404 });
      store[idx] = { ...store[idx], ...patch };
      return HttpResponse.json(store[idx]);
    }),
    http.delete(`${base}/:id`, ({ params }) => {
      const idx = store.findIndex((it) => String(it.id) === String(params.id));
      if (idx >= 0) store.splice(idx, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
