import type { CommunityIssue, IssueLocation } from '../../api/issues';

const validLocation = ({ latitude, longitude }: IssueLocation) =>
  Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;

export function issueMarkersScript(issues: CommunityIssue[]) {
  const markers = issues.filter(validLocation).map(({ id, title, latitude, longitude }) => ({ id, title, latitude, longitude }));
  const payload = JSON.stringify(markers).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.setIssues(${payload}); true;`;
}

export function reportLocationScript(location?: IssueLocation | null) {
  const point = location && validLocation(location) ? { latitude: location.latitude, longitude: location.longitude } : null;
  return `window.setReportLocation(${JSON.stringify(point)}); true;`;
}
