import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { issueMarkersScript, reportLocationScript } from '../src/components/maps/issueBridge';
import type { CommunityIssue } from '../src/api/issues';

const issue: CommunityIssue = { id: 3, title: '</script><script>unexpected()</script>', description: 'Report', latitude: 50.91, longitude: -1.41, status: 'submitted', category: 'pothole', created_at: '2026-10-17 12:00:00', photo_version: 1 };
test('community map bridge preserves coordinates and treats report text as data', () => {
  let markers: unknown;
  const script = issueMarkersScript([issue, { ...issue, id: 4, latitude: Number.NaN }]);
  assert.ok(!script.includes('</script>'));
  runInNewContext(script, { window: { setIssues: (data: unknown) => { markers = data; } } });
  assert.equal(JSON.stringify(markers), JSON.stringify([{ id: 3, title: issue.title, latitude: 50.91, longitude: -1.41 }]));
});
test('report pin bridge rejects invalid points and clears the previous pin', () => {
  let location: unknown;
  const context = { window: { setReportLocation: (data: unknown) => { location = data; } } };
  runInNewContext(reportLocationScript({ latitude: 50.91, longitude: -1.41 }), context);
  assert.equal(JSON.stringify(location), JSON.stringify({ latitude: 50.91, longitude: -1.41 }));
  runInNewContext(reportLocationScript({ latitude: 91, longitude: -1.41 }), context);
  assert.equal(location, null);
  runInNewContext(reportLocationScript(null), context);
  assert.equal(location, null);
});
