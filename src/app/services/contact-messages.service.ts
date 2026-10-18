import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CONTACT_MESSAGES,
  ContactFormValues,
  toContactRequest,
} from '../core/contact/contact-form';
import { ContactMessage } from '../models/contact-message.model';
import { AuthService } from './auth.service';

/** Confirmation returned by the backend once the message is stored. */
export interface ContactMessageConfirmation {
  id: string;
  status: string;
}

/** Response shape of `GET /contact-messages/mine`. */
interface ContactMessageListResponse {
  messages: ContactMessage[];
}

/** Error raised for contact API failures, with the backend status code. */
export class ContactApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ContactApiError';
  }
}

/**
 * Sends the "Contact Us" form to the BistroBuddies backend.
 *
 * `POST {apiBaseUrl}/contact-messages` carries exactly the four form fields;
 * the signed-in customer's Firebase ID token travels as a Bearer token and
 * the backend derives `userId` from the verified token (never from the
 * body). A `201 { id, status }` response means the message was stored in the
 * Firestore `contactMessages` collection — email delivery is not configured,
 * so nothing here may claim an email was sent.
 */
@Injectable({ providedIn: 'root' })
export class ContactMessagesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Submits the form. Rejects with a `ContactApiError` carrying a
   * customer-safe message for every failure mode (signed out, validation,
   * rate limit, server or network problems) so nothing internal leaks.
   */
  async submit(values: ContactFormValues): Promise<ContactMessageConfirmation> {
    const token = await this.auth.getIdToken();
    if (!token) {
      throw new ContactApiError(CONTACT_MESSAGES.auth, 401);
    }

    try {
      return await firstValueFrom(
        this.http.post<ContactMessageConfirmation>(
          `${this.baseUrl}/contact-messages`,
          toContactRequest(values),
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
    } catch (error) {
      throw toContactApiError(error);
    }
  }

  /**
   * Loads the signed-in customer's own contact messages, newest first.
   *
   * `GET {apiBaseUrl}/contact-messages/mine` carries the Firebase ID token;
   * the backend scopes the query to the verified user, so the client never
   * sends (and cannot influence) whose messages are returned. Rejects with a
   * `ContactApiError` for the same failure modes as `submit`.
   */
  async listMine(): Promise<ContactMessage[]> {
    const token = await this.auth.getIdToken();
    if (!token) {
      throw new ContactApiError(CONTACT_MESSAGES.auth, 401);
    }

    try {
      const response = await firstValueFrom(
        this.http.get<ContactMessageListResponse>(
          `${this.baseUrl}/contact-messages/mine`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      return response?.messages ?? [];
    } catch (error) {
      throw toContactApiError(error);
    }
  }
}

function toContactApiError(error: unknown): ContactApiError {
  if (error instanceof ContactApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) {
      return new ContactApiError(CONTACT_MESSAGES.auth, 401);
    }
    if (error.status === 429) {
      return new ContactApiError(CONTACT_MESSAGES.rateLimit, 429);
    }
    if (error.status === 400) {
      return new ContactApiError(CONTACT_MESSAGES.validation, 400);
    }
    return new ContactApiError(CONTACT_MESSAGES.server, error.status);
  }
  return new ContactApiError(CONTACT_MESSAGES.server, 0);
}
