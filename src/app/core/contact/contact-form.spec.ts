import {
  CONTACT_EMAIL_MAX,
  CONTACT_MESSAGE_MAX,
  CONTACT_MESSAGES,
  CONTACT_NAME_MAX,
  CONTACT_SUBJECT_MAX,
  contactEmailError,
  hasContactFormErrors,
  toContactRequest,
  validateContactForm,
} from './contact-form';

describe('contact form validation', () => {
  it('matches the backend field limits', () => {
    expect(CONTACT_NAME_MAX).toBe(120);
    expect(CONTACT_EMAIL_MAX).toBe(254);
    expect(CONTACT_SUBJECT_MAX).toBe(150);
    expect(CONTACT_MESSAGE_MAX).toBe(2000);
  });

  it('accepts a complete, well-formed submission', () => {
    const errors = validateContactForm({
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
      subject: 'Question about an order',
      message: 'I would like to ask about my order.',
    });

    expect(hasContactFormErrors(errors)).toBe(false);
  });

  it('rejects missing and whitespace-only values', () => {
    const errors = validateContactForm({
      name: '   ',
      email: '',
      subject: '\t',
      message: '   \n  ',
    });

    expect(errors.name).toBe('Name is required.');
    expect(errors.email).toBe('Email is required.');
    expect(errors.subject).toBe('Subject is required.');
    expect(errors.message).toBe('Message is required.');
    expect(hasContactFormErrors(errors)).toBe(true);
  });

  it('rejects a malformed email address', () => {
    expect(contactEmailError('not-an-email')).toBe('Please enter a valid email address.');
    expect(contactEmailError('juan@localhost')).toBe('Please enter a valid email address.');
    expect(contactEmailError('juan@example.com')).toBeNull();
  });

  it('rejects values over the backend maximum lengths', () => {
    const errors = validateContactForm({
      name: 'a'.repeat(CONTACT_NAME_MAX + 1),
      email: `${'a'.repeat(CONTACT_EMAIL_MAX)}@example.com`,
      subject: 'b'.repeat(CONTACT_SUBJECT_MAX + 1),
      message: 'c'.repeat(CONTACT_MESSAGE_MAX + 1),
    });

    expect(errors.name).toBe(`Name must be ${CONTACT_NAME_MAX} characters or fewer.`);
    expect(errors.subject).toBe(
      `Subject must be ${CONTACT_SUBJECT_MAX} characters or fewer.`
    );
    expect(errors.message).toBe(
      `Message must be ${CONTACT_MESSAGE_MAX} characters or fewer.`
    );
    expect(errors.email).toBe(
      `Email must be ${CONTACT_EMAIL_MAX} characters or fewer.`
    );
  });

  it('trims every field before building the request body', () => {
    expect(
      toContactRequest({
        name: '  Juan dela Cruz ',
        email: ' juan@example.com  ',
        subject: ' Question about an order',
        message: ' Thanks! \n',
      })
    ).toEqual({
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
      subject: 'Question about an order',
      message: 'Thanks!',
    });
  });

  it('exposes customer-safe messages for every failure mode', () => {
    expect(CONTACT_MESSAGES.success).toBe('Your message has been submitted successfully.');
    expect(CONTACT_MESSAGES.auth).toBe('Please sign in again to submit your message.');
    expect(CONTACT_MESSAGES.rateLimit).toContain('too quickly');
    expect(CONTACT_MESSAGES.validation).toContain('required fields');
    expect(CONTACT_MESSAGES.server).toContain('try again');
  });
});
