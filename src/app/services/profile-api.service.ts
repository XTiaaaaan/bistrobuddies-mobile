import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { resolveProductImageUrl } from '../core/products/product-image';
import { AuthService } from './auth.service';

/**
 * Image types the backend accepts. It re-checks them from the file's magic
 * bytes, so this list only drives the client-side pre-flight message.
 * (`../../../bistrobuddies-backend/docs/API_CONTRACT.md` §6)
 */
export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Label used in validation messages. */
export const ACCEPTED_IMAGE_LABELS = 'JPEG, PNG, or WebP';

/** Mirrors the backend's default `UPLOAD_MAX_BYTES` (5 MB). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Error raised for profile API failures, with the backend status code. */
export class ProfileApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

/**
 * Uploads the signed-in customer's profile picture to the backend.
 *
 * Files go to `POST {apiBaseUrl}/profile/photo` (multipart field `file`,
 * Firebase ID token as a Bearer token — any signed-in user is allowed, see
 * `../bistrobuddies-backend/docs/API_CONTRACT.md` §6). The backend stores the
 * bytes on its local dev disk and returns an absolute `imageUrl`; only that
 * URL string is written to Firestore, so image bytes never reach Firestore.
 *
 * Storage is local-disk and development-only — Firebase Storage is the
 * production path and is deliberately not implemented yet.
 */
@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Client-side pre-flight check mirroring the backend's rules, so an
   * unusable file is rejected before any request is made. Returns a message
   * to show the customer, or `null` when the file may be uploaded. The
   * backend stays authoritative — its magic-byte check can still reject a
   * file.
   */
  validate(file: File): string | null {
    if (file.size === 0) {
      return 'The selected image file is empty.';
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return 'The image is larger than the 5 MB upload limit.';
    }
    if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return `Only ${ACCEPTED_IMAGE_LABELS} images can be uploaded.`;
    }
    return null;
  }

  /**
   * Uploads `file` and resolves with the renderable `imageUrl` to store as
   * `users/{uid}.photoUrl`. Rejects with a `ProfileApiError` when the file
   * fails validation or the backend refuses the upload (401/413/415/429/…),
   * so nothing is ever reported as uploaded unless the backend confirmed it.
   */
  async uploadPhoto(file: File): Promise<string> {
    const issue = this.validate(file);
    if (issue) {
      throw new ProfileApiError(issue, 0);
    }

    const token = await this.auth.getIdToken();
    if (!token) {
      throw new ProfileApiError('You must be signed in to change your profile picture.', 401);
    }

    const form = new FormData();
    form.append('file', file, file.name);

    try {
      const { imageUrl } = await firstValueFrom(
        this.http.post<{ imageUrl: string }>(`${this.baseUrl}/profile/photo`, form, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      const url = resolveProductImageUrl(imageUrl);
      if (!url) {
        throw new ProfileApiError('The server did not return an image URL.', 0);
      }
      return url;
    } catch (error) {
      throw toProfileApiError(error);
    }
  }
}

function toProfileApiError(error: unknown): ProfileApiError {
  if (error instanceof ProfileApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const serverMessage = extractServerMessage(error);
    if (error.status === 0) {
      return new ProfileApiError(
        'Could not reach the BistroBuddies server. Please try again later.',
        0
      );
    }
    return new ProfileApiError(
      serverMessage ?? `The server rejected the image (${error.status}).`,
      error.status
    );
  }
  return new ProfileApiError('We could not upload your profile picture. Please try again.', 0);
}

function extractServerMessage(error: HttpErrorResponse): string | null {
  const body = error.error as { error?: { message?: unknown } } | null;
  const message = body?.error?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}
