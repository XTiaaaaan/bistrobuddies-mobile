import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  NotificationApiError,
  NotificationsApiService,
} from './notifications-api.service';

const baseUrl = environment.apiBaseUrl;

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('NotificationsApiService', () => {
  let httpMock: HttpTestingController;
  let service: NotificationsApiService;
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
    service = TestBed.inject(NotificationsApiService);
  });

  afterEach(() => httpMock.verify());

  it('registers an FCM token with the Bearer token and platform', async () => {
    const promise = service.registerDeviceToken('fcm-token', 'android');
    await flushMicrotasks();

    const request = httpMock.expectOne(`${baseUrl}/notifications/devices`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toEqual({
      token: 'fcm-token',
      platform: 'android',
    });
    request.flush({ id: 'hashed-token', platform: 'android' }, { status: 201, statusText: 'Created' });

    await expect(promise).resolves.toBeUndefined();
  });

  it('removes the token using a DELETE body and the Bearer token', async () => {
    const promise = service.removeDeviceToken('fcm-token');
    await flushMicrotasks();

    const request = httpMock.expectOne(`${baseUrl}/notifications/devices`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(request.request.body).toEqual({ token: 'fcm-token' });
    request.flush({ removed: true });

    await expect(promise).resolves.toBeUndefined();
  });

  it('fails before any request when the customer is signed out', async () => {
    getIdToken.mockResolvedValue(null);

    await expect(
      service.registerDeviceToken('fcm-token', 'android')
    ).rejects.toMatchObject({ name: 'NotificationApiError', status: 401 });
    httpMock.expectNone(`${baseUrl}/notifications/devices`);
  });

  it('surfaces backend rejections with their status', async () => {
    const promise = service.registerDeviceToken('fcm-token', 'ios');
    await flushMicrotasks();

    httpMock
      .expectOne(`${baseUrl}/notifications/devices`)
      .flush(
        { error: { message: 'Invalid device token.' } },
        { status: 400, statusText: 'Bad Request' }
      );

    await expect(promise).rejects.toEqual(
      expect.objectContaining<Partial<NotificationApiError>>({
        name: 'NotificationApiError',
        message: 'Invalid device token.',
        status: 400,
      })
    );
  });
});
