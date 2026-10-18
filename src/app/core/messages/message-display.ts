/**
 * Pure presentation helpers for the customer "My Messages" screen. The
 * vocabulary mirrors the backend workflow: messages start as `NEW`, an admin
 * may move them to `READ` or `RESOLVED`, and `RESOLVED` is final.
 */
import { ContactMessageStatus } from '../../models/contact-message.model';

const STATUSES: readonly ContactMessageStatus[] = ['NEW', 'READ', 'RESOLVED'];

function normalize(status: unknown): ContactMessageStatus | null {
  return typeof status === 'string' &&
    (STATUSES as readonly string[]).includes(status)
    ? (status as ContactMessageStatus)
    : null;
}

/** Short badge label; the raw status for anything unrecognized. */
export function contactMessageStatusLabel(status: unknown): string {
  return normalize(status) ?? (typeof status === 'string' && status ? status : 'UNKNOWN');
}

/** Friendly one-line explanation shown under the badge. */
export function contactMessageStatusHint(status: unknown): string {
  switch (status) {
    case 'NEW':
      return 'Submitted — awaiting review';
    case 'READ':
      return 'An admin has reviewed your message';
    case 'RESOLVED':
      return 'Your request has been addressed';
    default:
      return '';
  }
}

/** Badge class for a status (`msg-new`, `msg-read`, `msg-resolved`). */
export function contactMessageStatusClass(status: unknown): string {
  const known = normalize(status);
  return `badge msg-${known ? known.toLowerCase() : 'unknown'}`;
}

/** Single-line preview for the list; the full text lives in the detail view. */
export function messagePreview(message: string, maxLength = 120): string {
  const text = (message ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(maxLength - 1, 1))}…`;
}

/** Formats the backend ISO timestamp for display, or an em dash when unset. */
export function formatMessageDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
