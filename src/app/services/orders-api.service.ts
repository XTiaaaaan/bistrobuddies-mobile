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
