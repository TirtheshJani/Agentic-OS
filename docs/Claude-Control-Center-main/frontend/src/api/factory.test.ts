import { describe, expect, it } from 'vitest';
import { server } from '../test/msw/server';
import { resourceHandlers } from '../test/msw/handlers';
import { defineResource } from './factory';

interface Thing {
  id: string;
  name: string;
}

describe('defineResource', () => {
  const things = defineResource<Thing>({ base: '/api/things', keys: ['things'] });

  it('lists items via GET', async () => {
    const store: Thing[] = [{ id: 'a', name: 'A' }];
    server.use(...resourceHandlers('/api/things', store));
    const list = await things.list();
    expect(list).toEqual([{ id: 'a', name: 'A' }]);
  });

  it('creates an item via POST', async () => {
    const store: Thing[] = [];
    server.use(...resourceHandlers('/api/things', store));
    const created = await things.create({ id: 'b', name: 'B' });
    expect(created).toEqual({ id: 'b', name: 'B' });
    expect(store).toHaveLength(1);
  });

  it('exposes typed query keys', () => {
    expect(things.keys.list()).toEqual(['things', 'list']);
    expect(things.keys.detail('a')).toEqual(['things', 'detail', 'a']);
  });
});
