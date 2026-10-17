import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api } from '../src/api/client';
import { postComment } from '../src/api/comments';
import { useNotificationsStore } from '../src/store/notifications';
import { useSessionStore } from '../src/store/session';
import type { ReplyNotification } from '../src/api/notifications';

const adapter = api.defaults.adapter;
const notice: ReplyNotification = { id: 1, comment_id: 2, parent_id: 1, event_id: 3, event_title: 'Library', body: 'Agreed', user_email: null, created_at: '2026-10-17 12:00:00', is_read: false };
afterEach(() => { api.defaults.adapter = adapter; useSessionStore.getState().signOut(); });

test('reply sends its target and trimmed body', async () => {
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/events/3/comments');
    assert.deepEqual(JSON.parse(config.data), { body: 'Agreed', parent_id: 1 });
    return { config, data: { id: 2, parent_id: 1 }, status: 201, statusText: 'Created', headers: {} };
  };
  assert.equal((await postComment(3, ' Agreed ', 1)).parent_id, 1);
});

test('notifications retain data on failure and mark read only after server success', async () => {
  useSessionStore.getState().continueAsGuest();
  api.defaults.adapter = async (config) => ({ config, data: [notice], status: 200, statusText: 'OK', headers: {} });
  await useNotificationsStore.getState().refresh();
  assert.deepEqual(useNotificationsStore.getState().items, [notice]);
  api.defaults.adapter = async () => { throw new Error('offline'); };
  await useNotificationsStore.getState().refresh();
  assert.deepEqual(useNotificationsStore.getState().items, [notice]);
  assert.ok(useNotificationsStore.getState().error);
  await assert.rejects(useNotificationsStore.getState().markRead(1));
  assert.equal(useNotificationsStore.getState().items[0].is_read, false);
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/users/me/notifications/1/read');
    return { config, data: { is_read: true }, status: 200, statusText: 'OK', headers: {} };
  };
  await useNotificationsStore.getState().markRead(1);
  assert.equal(useNotificationsStore.getState().items[0].is_read, true);
});

test('session changes discard requests from the previous session', async () => {
  useSessionStore.getState().continueAsGuest();
  let finish!: () => void;
  api.defaults.adapter = async (config) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    return { config, data: [notice], status: 200, statusText: 'OK', headers: {} };
  };
  const loading = useNotificationsStore.getState().refresh();
  await new Promise((resolve) => setImmediate(resolve));
  useSessionStore.getState().signOut();
  finish();
  await loading;
  assert.deepEqual(useNotificationsStore.getState().items, []);
});
