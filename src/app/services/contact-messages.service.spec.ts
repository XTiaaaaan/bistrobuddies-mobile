import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { CONTACT_MESSAGES } from '../core/contact/contact-form';
import { AuthService } from './auth.service';
import { ContactApiError, ContactMessagesService } from './contact-messages.service';

const baseUrl = environment.apiBaseUrl;
const endpoint = `${baseUrl}/contact-messages`;

const form = {
  name: 'Juan dela Cruz',
  email: 'juan@example.com',
  subject: 'Question about an order',
  message: 'I would like to ask about my order.',
};

/** Lets the awaited ID token resolve so the HTTP request is actually issued. */
function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('ContactMessagesService', () => {
  let httpMock: HttpTestingController;
  let service: ContactMessagesService;
  let getIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getIdToken = vi.fn(() => Promise.resolve('id-token'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getIdToken } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ContactMessagesService);
  });

  afterEach(() => httpMock.verify());

  it('posts only the four form fields to /contact-messages with the Bearer token', async () => {
    const promise = service.submit(form);
    await flushMicrotasks();

    const request = httpMock.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.url).toBe(endpoint);
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toEqual({
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
      subject: 'Question about an order',
      message: 'I would like to ask about my order.',
    });
    expect(Object.keys(request.request.body).sort()).toEqual([
      'email',
      'message',
      'name',
      'subject',
    ]);
    request.flush({ id: 'msg-1', status: 'NEW' });

    await expect(promise).resolves.toEqual({ id: 'msg-1', status: 'NEW' });
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });

  it('trims the values it sends', async () => {
    const promise = service.submit({
      name: '  Juan  ',
      email: ' juan@example.com ',
      subject: ' Question ',
      message: ' Hello there ',
    });
    await flushMicrotasks();

    const request = httpMock.expectOne(endpoint);
    expect(request.request.body).toEqual({
      name: 'Juan',
      email: 'juan@example.com',
      subject: 'Question',
      message: 'Hello there',
    });
    request.flush({ id: 'msg-2', status: 'NEW' });
    await expect(promise).resolves.toEqual({ id: 'msg-2', status: 'NEW' });
  });

  it('fails before any request when the customer is signed out', async () => {
    getIdToken.mockResolvedValue(null);

    await expect(service.submit(form)).rejects.toMatchObject({
      name: 'ContactApiError',
      status: 401,
      message: CONTACT_MESSAGES.auth,
    });
    httpMock.expectNone(endpoint);
  });

  it('maps a 400 validation failure to the friendly field message', async () => {
    const promise = service.submit(form);
    await flushMicrotasks();

    httpMock.expectOne(endpoint).flush(
      { error: { code: 'invalid_request', message: 'The contact message payload is invalid.' } },
      { status: 400, statusText: 'Bad Request' }
    );

    const error = await promise.then(
      () => null,
      (reason: unknown) => reason as ContactApiError
    );
    expect(error).toBeInstanceOf(ContactApiError);
    expect(error?.status).toBe(400);
    expect(error?.message).toBe(CONTACT_MESSAGES.validation);
  });

  it('maps a 401 rejection to the sign-in message', async () => {
    const promise = service.submit(form);
    await flushMicrotasks();

    httpMock
      .expectOne(endpoint)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({
      status: 401,
      message: CONTACT_MESSAGES.auth,
    });
  });

  it('maps a 429 rate limit to the wait-and-retry message', async () => {
    const promise = service.submit(form);
    await flushMicrotasks();

    httpMock
      .expectOne(endpoint)
      .flush({}, { status: 429, statusText: 'Too Many Requests' });

    await expect(promise).rejects.toMatchObject({
      status: 429,
      message: CONTACT_MESSAGES.rateLimit,
    });
  });

  it('maps server and network failures without leaking internals', async () => {
    const serverPromise = service.submit(form);
    await flushMicrotasks();
    httpMock
      .expectOne(endpoint)
      .flush(
        { error: { code: 'internal_error', message: 'An unexpected error occurred.' } },
        { status: 500, statusText: 'Server Error' }
      );
    await expect(serverPromise).rejects.toMatchObject({
      status: 500,
      message: CONTACT_MESSAGES.server,
    });

    const networkPromise = service.submit(form);
    await flushMicrotasks();
    httpMock.expectOne(endpoint).error(new ProgressEvent('error'), {
      status: 0,
      statusText: 'Unknown Error',
    });
    await expect(networkPromise).rejects.toMatchObject({
      status: 0,
      message: CONTACT_MESSAGES.server,
    });
  });
});
