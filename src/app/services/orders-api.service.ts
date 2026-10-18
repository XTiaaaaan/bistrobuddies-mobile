import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { PaymentMethod } from '../models/payment.model';
import { ProductSize } from '../models/product.model';
import { AuthService } from './auth.service';

/** One line item sent to the backend. Prices are never sent — the server recomputes them. */
export interface CreateOrderItemRequest {
  productId: string;
  size: ProductSize;
  sugar: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
  customer: { name: string; phone: string };
  address: {
    recipientName: string;
    phone: string;
    address: string;
    city?: string;
    postalCode?: string;
  };
  customerComment: string;
  paymentMethod: PaymentMethod;
}

/** Authoritative order summary computed by the backend. */
export interface CreateOrderResponse {
  id: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderStatus: string;
  paymentStatus: string;
  /** Present on newer backend responses; absent on older ones. */
  paymentMethod?: string;
}

/** Customer-entered GCash details submitted to the backend. */
export interface GcashDetailsRequest {
  accountName: string;
  accountNumber: string;
}

/** Result of a GCash submission, reflecting the server's canonical state. */
export interface GcashDetailsResponse {
  id: string;
  paymentStatus: string;
  gcashDetails?: GcashDetailsRequest;
}

/** Response of POST /api/orders/:id/cancel — the full updated order. */
export interface CancelOrderResponse {
  id: string;
  orderStatus: string;
  paymentStatus: string;
}

/** Error raised for backend order API failures, with the backend status code. */
export class OrderApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'OrderApiError';
  }
}

/**
 * Talks to the BistroBuddies backend to create orders.
 *
 * Every request carries the signed-in user's Firebase ID token as a Bearer
 * token. The backend derives the customer identity from the verified token,
 * validates the payload, and computes all prices server-side.
 */
@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly baseUrl = environment.apiBaseUrl;

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const token = await this.auth.getIdToken();
    if (!token) {
      throw new OrderApiError('You must be signed in to place an order.', 401);
    }

    try {
      return await firstValueFrom(
        this.http.post<CreateOrderResponse>(`${this.baseUrl}/orders`, request, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
    } catch (error) {
      throw toOrderApiError(error);
    }
  }

  /**
   * Submits the customer's GCash account details for an existing order.
   *
   * Prices, totals and payment status are deliberately NOT sent: the backend
   * validates the payload, stores the details and moves the order to
   * VERIFYING. The Bearer Firebase ID token identifies the customer.
   */
  async submitGcashDetails(
    orderId: string,
    details: GcashDetailsRequest
  ): Promise<GcashDetailsResponse> {
    const token = await this.auth.getIdToken();
    if (!token) {
      throw new OrderApiError('You must be signed in to submit payment details.', 401);
    }

    try {
      return await firstValueFrom(
        this.http.post<GcashDetailsResponse>(
          `${this.baseUrl}/orders/${encodeURIComponent(orderId)}/gcash-details`,
          details,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
    } catch (error) {
      throw toOrderApiError(error);
    }
  }

  /**
   * Cancels one of the customer's own orders that is still awaiting
   * confirmation.
   *
   * The backend only allows cancelling a `PENDING` order owned by the caller;
   * it never deletes the order and leaves the payment status untouched, so a
   * cancelled order stays in My Orders. The Bearer Firebase ID token
   * identifies the customer.
   */
  async cancelOrder(orderId: string): Promise<CancelOrderResponse> {
    const token = await this.auth.getIdToken();
    if (!token) {
      throw new OrderApiError('You must be signed in to cancel an order.', 401);
    }

    try {
      return await firstValueFrom(
        this.http.post<CancelOrderResponse>(
          `${this.baseUrl}/orders/${encodeURIComponent(orderId)}/cancel`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
    } catch (error) {
      throw toOrderApiError(error);
    }
  }
}

function toOrderApiError(error: unknown): OrderApiError {
  if (error instanceof OrderApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const serverMessage = extractServerMessage(error);
    if (error.status === 0) {
      return new OrderApiError(
        'Could not reach the BistroBuddies server. Please try again later.',
        0
      );
    }
    return new OrderApiError(
      serverMessage ?? `The server rejected the request (${error.status}).`,
      error.status
    );
  }
  return new OrderApiError('We could not place your order. Please try again.', 0);
}

function extractServerMessage(error: HttpErrorResponse): string | null {
  const body = error.error as { error?: { message?: unknown } } | null;
  const message = body?.error?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}
