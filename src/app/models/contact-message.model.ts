/**
 * A customer's own "Contact Us" message as returned by the backend
 * (`GET /api/contact-messages/mine`). The backend scopes the query to the
 * signed-in user and strips sender identity, so no `userId`/`name`/`email`
 * is present here.
 */
export type ContactMessageStatus = 'NEW' | 'READ' | 'RESOLVED';

/**
 * An admin reply stored on a contact message, as returned by the backend
 * (`{ id, senderRole, reply, createdAt }` — the sender role and timestamp
 * are decided by the backend and only the Admin SDK writes replies).
 */
export interface ContactMessageReply {
  id: string;
  senderRole: 'ADMIN' | 'CUSTOMER';
  reply: string;
  /** ISO-8601 string from the backend serializer, or null when missing. */
  createdAt: string | null;
}

export interface ContactMessage {
  id: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  /** ISO-8601 string from the backend serializer, or null when missing. */
  createdAt: string | null;
  updatedAt: string | null;
  /** Admin replies for this message, oldest first (empty until one exists). */
  replies: ContactMessageReply[];
}
