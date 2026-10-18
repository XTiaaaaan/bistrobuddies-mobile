import {
  contactMessageStatusClass,
  contactMessageStatusHint,
  contactMessageStatusLabel,
  formatMessageDate,
  messagePreview,
} from './message-display';

describe('message-display', () => {
  it('labels the three known statuses', () => {
    expect(contactMessageStatusLabel('NEW')).toBe('NEW');
    expect(contactMessageStatusLabel('READ')).toBe('READ');
    expect(contactMessageStatusLabel('RESOLVED')).toBe('RESOLVED');
  });

  it('falls back safely for an unknown status', () => {
    expect(contactMessageStatusLabel('BOGUS')).toBe('BOGUS');
    expect(contactMessageStatusLabel(undefined)).toBe('UNKNOWN');
  });

  it('maps statuses to badge classes', () => {
    expect(contactMessageStatusClass('NEW')).toBe('badge msg-new');
    expect(contactMessageStatusClass('READ')).toBe('badge msg-read');
    expect(contactMessageStatusClass('RESOLVED')).toBe('badge msg-resolved');
    expect(contactMessageStatusClass('BOGUS')).toBe('badge msg-unknown');
  });

  it('describes each status in friendly language', () => {
    expect(contactMessageStatusHint('NEW')).toContain('awaiting review');
    expect(contactMessageStatusHint('READ')).toContain('reviewed');
    expect(contactMessageStatusHint('RESOLVED')).toContain('addressed');
    expect(contactMessageStatusHint('BOGUS')).toBe('');
  });

  it('collapses whitespace and truncates long previews', () => {
    expect(messagePreview('  Hello   there  ')).toBe('Hello there');
    const long = 'x'.repeat(200);
    const preview = messagePreview(long, 20);
    expect(preview.length).toBe(20);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('formats an ISO timestamp and degrades gracefully for missing values', () => {
    expect(formatMessageDate(null)).toBe('—');
    expect(formatMessageDate('not-a-date')).toBe('—');
    expect(formatMessageDate('2026-10-09T12:00:00.000Z')).toContain('2026');
  });
});
