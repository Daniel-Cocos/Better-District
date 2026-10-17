import type { CouncilEvent } from '../../api/events';
import { eventDeadlineLabel } from '../../utils/eventDeadline';

export function eventMarkersScript(events: CouncilEvent[]): string {
  const markers = events.map(({ id, title, description, latitude, longitude, closes_at }) => ({
    id, title, description, latitude, longitude, deadlineLabel: eventDeadlineLabel(closes_at),
  }));
  // Escape HTML delimiters as well as JS line separators at the WebView boundary.
  const payload = JSON.stringify(markers).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.setEvents(${payload}); true;`;
}

export function focusEventScript(event: Pick<CouncilEvent, 'latitude' | 'longitude'>): string {
  return `window.focusEvent(${JSON.stringify(event.latitude)}, ${JSON.stringify(event.longitude)}); true;`;
}
