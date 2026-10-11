/**
 * Pure helpers for the customer "Contact Us" form. The limits and rules
 * mirror the backend's `validateContactMessageRequest`
 * (`../bistrobuddies-backend/src/lib/validation.ts`) so obvious problems are
 * caught before a request is made — the server stays authoritative.
 */

/** Maximum accepted lengths enforced by the backend. */
export const CONTACT_NAME_MAX = 120;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_SUBJECT_MAX = 150;
export const CONTACT_MESSAGE_MAX = 2000;

/** The only four fields sent to `POST /contact-messages`. */
export interface ContactFormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactField = keyof ContactFormValues;

export type ContactFormErrors = Partial<Record<ContactField, string>>;

/** Same shape the backend uses to reject malformed email addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Customer-facing copy for every outcome of a submission. */
export const CONTACT_MESSAGES = {
  success: 'Your message has been submitted successfully.',
  validation: 'Please check the required fields and try again.',
  auth: 'Please sign in again to submit your message.',
  rateLimit: "You've sent messages too quickly. Please wait and try again.",
  server: "We couldn't submit your message. Please try again.",
} as const;

function requiredChecked(
  raw: string,
  label: string,
  max: number
): string | null {
  const value = raw.trim();
  if (!value) {
    return `${label} is required.`;
  }
  if (value.length > max) {
    return `${label} must be ${max} characters or fewer.`;
  }
  return null;
}

/** `null` when the email is usable, otherwise the message to show. */
export function contactEmailError(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return 'Email is required.';
  }
  if (value.length > CONTACT_EMAIL_MAX) {
    return `Email must be ${CONTACT_EMAIL_MAX} characters or fewer.`;
  }
  if (!EMAIL_PATTERN.test(value)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

/**
 * Validates the whole form. Values are judged after trimming, so
 * whitespace-only input is rejected exactly like the backend rejects it.
 */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  const name = requiredChecked(values.name, 'Name', CONTACT_NAME_MAX);
  if (name) {
    errors.name = name;
  }

  const email = contactEmailError(values.email);
  if (email) {
    errors.email = email;
  }

  const subject = requiredChecked(values.subject, 'Subject', CONTACT_SUBJECT_MAX);
  if (subject) {
    errors.subject = subject;
  }

  const message = requiredChecked(values.message, 'Message', CONTACT_MESSAGE_MAX);
  if (message) {
    errors.message = message;
  }

  return errors;
}

export function hasContactFormErrors(errors: ContactFormErrors): boolean {
  return Object.values(errors).some((error) => error !== undefined);
}

/** Trimmed payload — the only body ever sent to the backend. */
export function toContactRequest(values: ContactFormValues): ContactFormValues {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    subject: values.subject.trim(),
    message: values.message.trim(),
  };
}
