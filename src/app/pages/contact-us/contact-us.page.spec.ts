import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SignInPromptService } from '../../core/auth/sign-in-prompt.service';
import { CONTACT_MESSAGES } from '../../core/contact/contact-form';
import { AuthService } from '../../services/auth.service';
import { ContactApiError, ContactMessagesService } from '../../services/contact-messages.service';
import { UsersService } from '../../services/users.service';
import { ContactUsPage } from './contact-us.page';

const profileDoc = {
  uid: 'u1',
  name: 'Juan dela Cruz',
  firstName: 'Juan',
  lastName: 'dela Cruz',
  email: 'juan@example.com',
  phone: '',
  address: '',
  role: 'customer',
};

const signedInUser = {
  uid: 'u1',
  email: 'juan@example.com',
  displayName: 'Juan dela Cruz',
};

const validForm = {
  name: 'Juan dela Cruz',
  email: 'juan@example.com',
  subject: 'Question about an order',
  message: 'I would like to ask about my order.',
};

interface SetupOptions {
  user?: unknown;
  submit?: ReturnType<typeof vi.fn>;
  getUser?: () => Promise<typeof profileDoc | null>;
  requireSignIn?: ReturnType<typeof vi.fn>;
}

describe('ContactUsPage', () => {
  function setup(options: SetupOptions = {}): {
    fixture: ComponentFixture<ContactUsPage>;
    component: ContactUsPage;
    submit: ReturnType<typeof vi.fn>;
    requireSignIn: ReturnType<typeof vi.fn>;
  } {
    const user = 'user' in options ? options.user : signedInUser;
    const submit =
      options.submit ?? vi.fn(() => Promise.resolve({ id: 'msg-1', status: 'NEW' }));
    const getUser = options.getUser ?? (() => Promise.resolve(profileDoc));
    const requireSignIn =
      options.requireSignIn ?? vi.fn(() => Promise.resolve(user !== null));

    TestBed.configureTestingModule({
      imports: [ContactUsPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of(user) } },
        { provide: UsersService, useValue: { getUser } },
        { provide: ContactMessagesService, useValue: { submit } },
        { provide: SignInPromptService, useValue: { requireSignIn } },
      ],
    });

    const fixture = TestBed.createComponent(ContactUsPage);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, submit, requireSignIn };
  }

  function fill(component: ContactUsPage, form: typeof validForm = validForm): void {
    component.setName(form.name);
    component.setEmail(form.email);
    component.setSubject(form.subject);
    component.setMessage(form.message);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the company contact details with tappable phone and email links', () => {
    const { fixture } = setup();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('BistroBuddies');
    expect(text).toContain('Quezon City, Philippines');

    const tel = element.querySelector('a[href^="tel:"]');
    expect(tel?.getAttribute('href')).toBe('tel:09123456789');
    expect(tel?.textContent?.trim()).toBe('09123456789');

    const mail = element.querySelector('a[href^="mailto:"]');
    expect(mail?.getAttribute('href')).toBe('mailto:bistrobuddies@gmail.com');
    expect(mail?.textContent?.trim()).toBe('bistrobuddies@gmail.com');
  });

  it('prefills the form with the signed-in customer name and email', async () => {
    const { fixture, component } = setup();
    await fixture.whenStable();

    expect(component.name()).toBe('Juan dela Cruz');
    expect(component.email()).toBe('juan@example.com');
  });

  it('does not overwrite a name the customer already typed', async () => {
    const { fixture, component } = setup();
    component.setName('Someone Else');
    await fixture.whenStable();

    expect(component.name()).toBe('Someone Else');
  });

  it('requires every field and a valid email before sending anything', async () => {
    const { fixture, component, submit } = setup();
    // Let the profile prefill finish first, then clear the fields like a customer would.
    await fixture.whenStable();
    component.setName('   ');
    component.setEmail('not-an-email');
    component.setSubject('');
    component.setMessage('   ');

    await component.submit();
    fixture.detectChanges();

    expect(submit).not.toHaveBeenCalled();
    expect(component.submitted()).toBe(false);
    expect(component.showErrors()).toBe(true);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Name is required.');
    expect(text).toContain('Please enter a valid email address.');
    expect(text).toContain('Subject is required.');
    expect(text).toContain('Message is required.');
  });

  it('rejects a whitespace-only message', async () => {
    const { component, submit } = setup();
    fill(component, { ...validForm, message: '    ' });

    await component.submit();

    expect(submit).not.toHaveBeenCalled();
    expect(component.messageError()).toBe('Message is required.');
  });

  it('submits the trimmed values and confirms only after the backend responds', async () => {
    const { fixture, component, submit } = setup();
    fill(component, { ...validForm, name: '  Juan dela Cruz ', message: ' Hello!  ' });

    await component.submit();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
      subject: 'Question about an order',
      message: 'Hello!',
    });
    expect(component.submitted()).toBe(true);
    expect(component.formError()).toBeNull();
    // The draft content is cleared, but the identity fields stay for next time.
    expect(component.subject()).toBe('');
    expect(component.message()).toBe('');
    expect(component.name().trim()).toBe('Juan dela Cruz');

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Your message has been submitted successfully.');
    expect(text).toContain('Messages are submitted to BistroBuddies');
  });

  it('keeps the entered values and reports a server failure without a false success', async () => {
    const { fixture, component, submit } = setup({
      submit: vi.fn(() =>
        Promise.reject(new ContactApiError(CONTACT_MESSAGES.server, 500))
      ),
    });
    fill(component);

    await component.submit();
    fixture.detectChanges();

    expect(component.submitted()).toBe(false);
    expect(component.formError()).toBe(CONTACT_MESSAGES.server);
    expect(component.name()).toBe(validForm.name);
    expect(component.subject()).toBe(validForm.subject);
    expect(component.message()).toBe(validForm.message);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Message not sent');
    expect(text).not.toContain('Your message has been submitted successfully.');
  });

  it('explains a rate limit and a validation rejection in customer language', async () => {
    const rateLimited = setup({
      submit: vi.fn(() =>
        Promise.reject(new ContactApiError(CONTACT_MESSAGES.rateLimit, 429))
      ),
    });
    fill(rateLimited.component);
    await rateLimited.component.submit();
    expect(rateLimited.component.formError()).toBe(CONTACT_MESSAGES.rateLimit);
    rateLimited.fixture.destroy();
    TestBed.resetTestingModule();

    const invalid = setup({
      submit: vi.fn(() =>
        Promise.reject(new ContactApiError(CONTACT_MESSAGES.validation, 400))
      ),
    });
    fill(invalid.component);
    await invalid.component.submit();
    expect(invalid.component.formError()).toBe(CONTACT_MESSAGES.validation);
    expect(invalid.component.submitted()).toBe(false);
  });

  it('offers the sign-in flow when the backend rejects the session', async () => {
    const { fixture, component, submit } = setup({
      submit: vi.fn(() =>
        Promise.reject(new ContactApiError(CONTACT_MESSAGES.auth, 401))
      ),
    });
    fill(component);

    await component.submit();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(component.formError()).toBe(CONTACT_MESSAGES.auth);
    expect(component.authError()).toBe(true);
    expect(component.submitted()).toBe(false);

    const element = fixture.nativeElement as HTMLElement;
    const signIn = element.querySelector('.notice [href*="/login"]');
    expect(signIn).not.toBeNull();
    expect(signIn?.getAttribute('href')).toContain('reason=expired');
  });

  it('blocks duplicate submissions while a request is in flight', async () => {
    let confirm: (value: { id: string; status: string }) => void = () => undefined;
    const submit = vi.fn(
      () =>
        new Promise<{ id: string; status: string }>((resolve) => {
          confirm = resolve;
        })
    );
    const { component } = setup({ submit });
    fill(component);

    const first = component.submit();
    const second = component.submit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(component.submitting()).toBe(true);

    confirm({ id: 'msg-9', status: 'NEW' });
    await Promise.all([first, second]);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(component.submitted()).toBe(true);
  });

  it('asks guests to sign in and never posts a message for them', async () => {
    const { fixture, component, submit, requireSignIn } = setup({ user: null });

    expect(component.signedIn()).toBe(false);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sign in to send a message');

    fill(component);
    await component.submit();

    expect(requireSignIn).toHaveBeenCalledWith('/contact-us');
    expect(submit).not.toHaveBeenCalled();
    expect(component.submitted()).toBe(false);
  });

  it('never claims the message was emailed', () => {
    const { fixture } = setup();
    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').toLowerCase();

    expect(text).toContain('submitted to bistrobuddies');
    expect(text).not.toContain('emailed');
    expect(text).not.toContain('we will email you');
  });
});
