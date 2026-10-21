import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type DevicePlatform = 'android' | 'ios' | 'web' | 'unknown';

export class NotificationApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'NotificationApiError';
  }
}

/**
 * Device-token endpoints. Registration is idempotent on the backend and moves
 * a token to the current account, which is what a shared device needs.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl;

  async registerDeviceToken(
    token: string,
    platform: DevicePlatform
  ): Promise<void> {
    const idToken = await this.requireIdToken('register this device');
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/notifications/devices`,
          { token, platform },
          { headers: { Authorization: `Bearer ${idToken}` } }
        )
      );
    } catch (error) {
      throw toNotificationApiError(error);
    }
  }

  async removeDeviceToken(token: string): Promise<void> {
    const idToken = await this.requireIdToken('remove this device');
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/notifications/devices`, {
          headers: { Authorization: `Bearer ${idToken}` },
          body: { token },
        })
      );
    } catch (error) {
      throw toNotificationApiError(error);
    }
  }

  private async requireIdToken(action: string): Promise<string> {
    const token = await this.auth.getIdToken();
    if (!token) {
      throw new NotificationApiError(
        `You must be signed in to ${action}.`,
        401
      );
    }
    return token;
  }
}

function toNotificationApiError(error: unknown): NotificationApiError {
  if (error instanceof NotificationApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    return new NotificationApiError(
      extractServerMessage(error) ??
        `The notification service rejected the request (${error.status}).`,
      error.status
    );
  }
  return new NotificationApiError(
    'Could not reach the notification service.',
    0
  );
}

function extractServerMessage(error: HttpErrorResponse): string | null {
  const body = error.error as { error?: { message?: unknown } } | null;
  const message = body?.error?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}
