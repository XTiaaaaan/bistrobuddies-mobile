import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  MAX_IMAGE_BYTES,
  ProfileApiError,
  ProfileApiService,
} from './profile-api.service';

const baseUrl = environment.apiBaseUrl;

/** Lets the awaited ID token resolve so the HTTP request is actually issued. */
function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function file(type: string, bytes = 8): File {
  return new File([new Uint8Array(bytes)], 'photo', { type });
}

describe('ProfileApiService', () => {
  let httpMock: HttpTestingController;
  let service: ProfileApiService;
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
    service = TestBed.inject(ProfileApiService);
  });

  afterEach(() => httpMock.verify());

  describe('validate', () => {
    it('accepts a JPEG, PNG or WebP under the size limit', () => {
      expect(service.validate(file('image/jpeg'))).toBeNull();
      expect(service.validate(file('image/png'))).toBeNull();
      expect(service.validate(file('image/webp'))).toBeNull();
    });

    it('rejects an empty file', () => {
      expect(service.validate(file('image/jpeg', 0))).toBe(
        'The selected image file is empty.'
      );
    });

    it('rejects a file above 5 MB', () => {
      const big = new File([new Uint8Array(16)], 'big.png', { type: 'image/png' });
      Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 });
      expect(service.validate(big)).toBe(
        'The image is larger than the 5 MB upload limit.'
      );
    });

    it('rejects an unsupported image type', () => {
      expect(service.validate(file('image/gif'))).toBe(
        'Only JPEG, PNG, or WebP images can be uploaded.'
      );
    });
  });

  describe('uploadPhoto', () => {
    it('posts the file as multipart "file" with the Bearer token', async () => {
      const promise = service.uploadPhoto(file('image/png'));
      await flushMicrotasks();

      const request = httpMock.expectOne(`${baseUrl}/profile/photo`);
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('Authorization')).toBe('Bearer id-token');
      expect(request.request.body).toBeInstanceOf(FormData);
      expect((request.request.body as FormData).has('file')).toBe(true);
      expect((request.request.body as FormData).getAll('file')).toHaveLength(1);
      request.flush({
        imageUrl: 'http://localhost:3001/uploads/1760000000000-abc.png',
      });

      await expect(promise).resolves.toBe(
        'http://localhost:3001/uploads/1760000000000-abc.png'
      );
      expect(getIdToken).toHaveBeenCalledTimes(1);
    });

    it('resolves a backend-relative /uploads path against the API origin', async () => {
      const promise = service.uploadPhoto(file('image/png'));
      await flushMicrotasks();

      httpMock.expectOne(`${baseUrl}/profile/photo`).flush({
        imageUrl: '/uploads/1760000000000-abc.png',
      });

      await expect(promise).resolves.toBe(
        'http://localhost:3001/uploads/1760000000000-abc.png'
      );
    });

    it('fails before any request when the user is signed out', async () => {
      getIdToken.mockResolvedValue(null);

      await expect(service.uploadPhoto(file('image/png'))).rejects.toMatchObject({
        name: 'ProfileApiError',
        status: 401,
      });
      httpMock.expectNone(`${baseUrl}/profile/photo`);
    });

    it('rejects an invalid file without any request', async () => {
      await expect(service.uploadPhoto(file('image/gif'))).rejects.toBeInstanceOf(
        ProfileApiError
      );
      httpMock.expectNone(`${baseUrl}/profile/photo`);
    });

    it('surfaces the backend error message and status', async () => {
      const promise = service.uploadPhoto(file('image/png'));
      await flushMicrotasks();

      httpMock
        .expectOne(`${baseUrl}/profile/photo`)
        .flush(
          { error: { code: 'file_too_large', message: 'The image is larger than the 5 MB upload limit.' } },
          { status: 413, statusText: 'Payload Too Large' }
        );

      const error = await promise.then(
        () => null,
        (reason: unknown) => reason as ProfileApiError
      );
      expect(error).toBeInstanceOf(ProfileApiError);
      expect(error?.status).toBe(413);
      expect(error?.message).toBe('The image is larger than the 5 MB upload limit.');
    });
  });
});
