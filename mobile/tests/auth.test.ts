import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { authErrorMessage, register, signIn } from '../src/api/auth';
import { useSessionStore } from '../src/store/session';

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  useSessionStore.getState().signOut();
  api.defaults.adapter = originalAdapter;
});

function respond(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { data, status, statusText: 'OK', headers: {}, config };
}

test('sign-in verifies normalized credentials against the backend before creating a session', async () => {
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/users/me');
    assert.deepEqual(config.auth, { username: 'user@example.com', password: 'secret123' });
    assert.equal(useSessionStore.getState().session.status, 'signedOut');
    return respond(config, { email: 'user@example.com' });
  };
  const result = await signIn(' User@Example.com ', 'secret123');
  useSessionStore.getState().signIn(result.email, result.credentials);
  assert.equal(useSessionStore.getState().session.status, 'authenticated');
});

test('failed sign-in leaves the session signed out', async () => {
  api.defaults.adapter = async (config) => {
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, respond(config, {}, 401));
  };
  await assert.rejects(signIn('user@example.com', 'wrong'), (error) => {
    assert.equal(authErrorMessage(error), 'Email or password is incorrect.');
    return true;
  });
  assert.equal(useSessionStore.getState().session.status, 'signedOut');
});

test('registration creates a user then verifies credentials', async () => {
  const requests: string[] = [];
  api.defaults.adapter = async (config) => {
    requests.push(`${config.method} ${config.url}`);
    if (config.method === 'post') {
      assert.equal(config.auth, undefined);
      assert.deepEqual(JSON.parse(config.data), { email: 'user@example.com', password: 'secret123' });
    } else {
      assert.deepEqual(config.auth, { username: 'user@example.com', password: 'secret123' });
    }
    return respond(config, { email: 'user@example.com' });
  };
  await register(' User@Example.com ', 'secret123');
  assert.deepEqual(requests, ['post /users', 'get /users/me']);
});

test('guest mode and sign-out remove credentials from subsequent API requests', async () => {
  const store = useSessionStore.getState();
  const credentials = { username: 'user@example.com', password: 'secret123' };
  api.defaults.adapter = async (config) => respond(config, config.auth);
  store.signIn(credentials.username, credentials);
  assert.deepEqual((await api.get('/events')).data, credentials);
  store.continueAsGuest();
  assert.deepEqual(useSessionStore.getState().session, { status: 'guest' });
  assert.equal((await api.get('/events')).data, undefined);
  store.signIn(credentials.username, credentials);
  store.signOut();
  assert.deepEqual(useSessionStore.getState().session, { status: 'signedOut' });
  assert.equal((await api.get('/events')).data, undefined);
});

test('network and duplicate account errors have useful messages', () => {
  assert.match(authErrorMessage(new AxiosError('Network Error')), /Could not reach/);
  const config = {} as InternalAxiosRequestConfig;
  const conflict = new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, respond(config, {}, 409));
  assert.match(authErrorMessage(conflict), /already registered/);
});
