import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { api } from '../src/api/client';
import type { CouncilEvent } from '../src/api/events';
import { useSessionStore } from '../src/store/session';
import { useEventsStore } from '../src/store/events';
import { eventMarkersScript, focusEventScript } from '../src/components/maps/eventBridge';
import { eventDeadlineLabel } from '../src/utils/eventDeadline';
import { listComments, postComment } from '../src/api/comments';
import { getEventsVersion } from '../src/api/events';

const adapter = api.defaults.adapter;
const event: CouncilEvent = { id: 1, title: 'Common clean-up', description: 'Community litter pick', latitude: 50.9297, longitude: -1.412, likes: 0, dislikes: 0, closes_at: '2026-11-01T17:00:00Z', my_vote: 0 };

afterEach(() => {
  api.defaults.adapter = adapter;
  useSessionStore.getState().signOut();
  useEventsStore.setState({ events: [], loading: false, error: null });
});

test('guests load real event coordinates from the API', async () => {
  useSessionStore.getState().continueAsGuest();
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/events');
    assert.equal(config.auth, undefined);
    return { config, data: [event], status: 200, statusText: 'OK', headers: {} };
  };
  await useEventsStore.getState().loadEvents();
  assert.deepEqual(useEventsStore.getState().events, [event]);
  assert.equal(useEventsStore.getState().loading, false);
});

test('failed refresh retains existing pins, reports an error, and can be retried', async () => {
  useEventsStore.setState({ events: [event] });
  api.defaults.adapter = async () => { throw new Error('offline'); };
  await useEventsStore.getState().loadEvents();
  assert.deepEqual(useEventsStore.getState().events, [event]);
  assert.match(useEventsStore.getState().error ?? '', /backend/);
  assert.equal(useEventsStore.getState().loading, false);
  api.defaults.adapter = async (config) => ({ config, data: [], status: 200, statusText: 'OK', headers: {} });
  await useEventsStore.getState().loadEvents();
  assert.deepEqual(useEventsStore.getState().events, []);
  assert.equal(useEventsStore.getState().error, null);
});

test('overlapping loads do not start duplicate requests', async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  api.defaults.adapter = async (config) => {
    requests++;
    await gate;
    return { config, data: [event], status: 200, statusText: 'OK', headers: {} };
  };
  const first = useEventsStore.getState().loadEvents();
  await useEventsStore.getState().loadEvents();
  release();
  await first;
  assert.equal(requests, 1);
});

test('WebView bridge treats event text as data and sends no account information', () => {
  const title = '</script><script>throw new Error("injected")</script>\u2028';
  let received: unknown;
  const script = eventMarkersScript([{ ...event, title }]);
  assert.equal(script.includes('</script>'), false);
  runInNewContext(script, { window: { setEvents: (markers: unknown) => { received = markers; } } });
  assert.equal(JSON.stringify(received), JSON.stringify([{ id: event.id, title, description: event.description, latitude: event.latitude, longitude: event.longitude, deadlineLabel: eventDeadlineLabel(event.closes_at) }]));
});

test('deadline labels distinguish open, closed, and unknown times', () => {
  const deadline = '2026-11-01T17:00:00Z';
  assert.match(eventDeadlineLabel(deadline, Date.parse('2026-10-17T12:00:00Z')), /^Closes \/ action due:/);
  assert.match(eventDeadlineLabel(deadline, Date.parse(deadline)), /^Closed \/ action due:/);
  assert.equal(eventDeadlineLabel(null), 'Closing time not set');
  assert.equal(eventDeadlineLabel('invalid'), 'Closing time not set');
  assert.equal(eventDeadlineLabel('2026-11-01T18:00:00+01:00', 0), eventDeadlineLabel(deadline, 0));
});

test('event comments load and guests post anonymously to the selected event', async () => {
  useSessionStore.getState().continueAsGuest();
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/events/3/comments');
    assert.equal(config.auth, undefined);
    if (config.method === 'get') return { config, data: [], status: 200, statusText: 'OK', headers: {} };
    assert.deepEqual(JSON.parse(config.data), { body: 'Looking forward to the picnic!' });
    return { config, data: { id: 11, event_id: 3, body: 'Looking forward to the picnic!', user_email: null, likes: 0, dislikes: 0 }, status: 201, statusText: 'Created', headers: {} };
  };
  assert.deepEqual(await listComments(3), []);
  const comment = await postComment(3, '  Looking forward to the picnic!  ');
  assert.equal(comment.event_id, 3);
  assert.equal(comment.user_email, null);
});

test('signed-in comments send account credentials and posting failures propagate', async () => {
  const credentials = { username: 'user@example.com', password: 'secret123' };
  useSessionStore.getState().signIn(credentials.username, credentials);
  api.defaults.adapter = async (config) => {
    assert.deepEqual(config.auth, credentials);
    throw new Error('Server unavailable');
  };
  await assert.rejects(postComment(1, 'Please include an accessible route.'), /Server unavailable/);
});

test('focusing a feed event preserves latitude/longitude order across the map bridge', () => {
  let coordinates: number[] = [];
  runInNewContext(focusEventScript(event), { window: {
    focusEvent: (latitude: number, longitude: number) => { coordinates = [latitude, longitude]; },
  } });
  assert.deepEqual(coordinates, [50.9297, -1.412]);
});


test('event votes update shared state only after successful server responses', async () => {
  useEventsStore.setState({ events: [event] });
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/events/1/vote');
    assert.equal(config.method, 'put');
    assert.deepEqual(JSON.parse(config.data), { vote: 1 });
    return { config, data: { ...event, likes: 1, my_vote: 1 }, status: 200, statusText: 'OK', headers: {} };
  };
  await useEventsStore.getState().voteEvent(1, 1);
  assert.equal(useEventsStore.getState().events[0].likes, 1);
  api.defaults.adapter = async () => { throw new Error('offline'); };
  await assert.rejects(useEventsStore.getState().voteEvent(1, -1), /offline/);
  assert.equal(useEventsStore.getState().events[0].my_vote, 1);
});

const added: CouncilEvent = { ...event, id: 2, title: 'Bargate square' };

test('background refreshes add new pins quietly and keep pins when offline', async () => {
  useEventsStore.setState({ events: [event] });
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/events');
    return { config, data: [event, added], status: 200, statusText: 'OK', headers: {} };
  };
  const refresh = useEventsStore.getState().refreshEvents();
  assert.equal(useEventsStore.getState().loading, false);
  await refresh;
  assert.deepEqual(useEventsStore.getState().events, [event, added]);
  api.defaults.adapter = async () => { throw new Error('offline'); };
  await useEventsStore.getState().refreshEvents();
  assert.deepEqual(useEventsStore.getState().events, [event, added]);
  assert.equal(useEventsStore.getState().error, null);
});

test('the change version is read from the public events endpoint', async () => {
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/events/version');
    return { config, data: { version: '7:7:0:0|1:x|0:0' }, status: 200, statusText: 'OK', headers: {} };
  };
  assert.equal(await getEventsVersion(), '7:7:0:0|1:x|0:0');
});
