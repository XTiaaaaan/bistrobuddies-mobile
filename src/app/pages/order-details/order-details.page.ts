import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe, receipt } from 'ionicons/icons';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { GcashSubmissionFormComponent } from '../../components/gcash-submission-form/gcash-submission-form.component';
import {
  formatOrderDate,
  formatOrderPrice,
  orderStatusClass,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusClass,
  paymentStatusLabel,
} from '../../core/orders/order-display';
import { GCASH_MESSAGES, GCASH_QR_ASSET } from '../../core/payment/gcash';
import { refundDisplay, RefundDisplay } from '../../core/orders/refund-display';
import { Order, OrderStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';
import { OrderApiError, OrdersApiService } from '../../services/orders-api.service';

/** Shown when cancelling fails for a reason the customer cannot fix here. */
export const CANCEL_FAILED_MESSAGE =
  'We could not cancel your order. Please try again.';

export type OrderDetailsStatus = 'loading' | 'ready' | 'missing' | 'error' | 'signed-out';

@Component({
  selector: 'app-order-details',
  templateUrl: './order-details.page.html',
  styleUrls: ['./order-details.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RouterLink,
    GcashSubmissionFormComponent,
  ],
})
export class OrderDetailsPage implements OnInit {
  readonly id = input.required<string>();

  readonly status = signal<OrderDetailsStatus>('loading');
  readonly order = signal<Order | null>(null);
  readonly resubmitOpen = signal(false);
  /** Whether the inline cancel confirmation is visible. */
  readonly cancelOpen = signal(false);
  /** Guards against duplicate cancel requests while one is in flight. */
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);

  readonly gcashQrAsset = GCASH_QR_ASSET;
  readonly gcashMessages = GCASH_MESSAGES;

  private readonly authService = inject(AuthService);
  private readonly ordersService = inject(OrdersService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * A customer may cancel only while the order is still awaiting
   * confirmation; once an admin has taken over, only the shop can stop it.
   */
  readonly canCancel = computed(
    () =>
      this.status() === 'ready' &&
      this.order()?.orderStatus === OrderStatus.PENDING
  );
  readonly cancelled = computed(
    () => this.order()?.orderStatus === OrderStatus.CANCELLED
  );

  /**
   * Refund facts for a cancelled order, straight from the backend's
   * `refund.status`. Hidden for every other order status; never mutates
   * cancellation or payment state.
   */
  readonly refund = computed<RefundDisplay>(() => refundDisplay(this.order()));

  readonly isGcashOrder = computed(
    () => this.order()?.paymentMethod === PaymentMethod.GCASH
  );
  readonly gcashPaymentStatus = computed<PaymentStatus | null>(() => {
    const order = this.order();
    return order ? ((order.paymentStatus as PaymentStatus) ?? null) : null;
  });
  /** Whether the details form should be visible for this order. */
  readonly showGcashForm = computed(() => {
    const order = this.order();
    if (!order || order.paymentMethod !== PaymentMethod.GCASH) {
      return false;
    }
    if (order.paymentStatus === PaymentStatus.REJECTED) {
      return this.resubmitOpen();
    }
    return order.paymentStatus === PaymentStatus.PENDING;
  });
  /** Shown after a rejection so the customer understands what to do. */
  readonly gcashRejected = computed(
    () => this.isGcashOrder() && this.gcashPaymentStatus() === PaymentStatus.REJECTED
  );
  readonly gcashVerifying = computed(
    () => this.isGcashOrder() && this.gcashPaymentStatus() === PaymentStatus.VERIFYING
  );
  readonly gcashPaid = computed(
    () => this.isGcashOrder() && this.gcashPaymentStatus() === PaymentStatus.PAID
  );
  readonly canResubmit = computed(
    () =>
      this.isGcashOrder() &&
      this.gcashPaymentStatus() === PaymentStatus.REJECTED &&
      !this.resubmitOpen()
  );

  constructor() {
    addIcons({ alertCircle, cafe, receipt });
  }

  ngOnInit(): void {
    this.authService.uid$
      .pipe(
        distinctUntilChanged(),
        switchMap((uid) => {
          if (!uid) {
            this.status.set('signed-out');
            return of(null);
          }

          this.status.set('loading');
          return this.ordersService.watchOrder(this.id()).pipe(
            map((order) => ({ uid, order })),
            catchError(() => {
              this.status.set('error');
              return of(null);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }

        const { uid, order } = result;
        if (!order || order.customerId !== uid) {
          this.order.set(null);
          this.status.set('missing');
          return;
        }

        this.order.set(order);
        this.status.set('ready');
      });
  }

  openResubmit(): void {
    this.resubmitOpen.set(true);
  }

  /** Shows the inline confirmation before any request is sent. */
  openCancelConfirm(): void {
    if (this.canCancel() && !this.cancelling()) {
      this.cancelOpen.set(true);
      this.cancelError.set(null);
    }
  }

  closeCancelConfirm(): void {
    if (!this.cancelling()) {
      this.cancelOpen.set(false);
      this.cancelError.set(null);
    }
  }

  /** Confirms the dialog and asks the backend to cancel the order. */
  async confirmCancel(): Promise<void> {
    const current = this.order();
    if (
      !this.cancelOpen() ||
      !current ||
      current.orderStatus !== OrderStatus.PENDING ||
      this.cancelling()
    ) {
      return;
    }

    this.cancelling.set(true);
    this.cancelError.set(null);
    try {
      const result = await this.ordersApi.cancelOrder(current.id);
      // Reflect the new status right away; the realtime listener will also
      // deliver the updated document from Firestore.
      this.order.set({
        ...current,
        orderStatus: (result.orderStatus as OrderStatus) ?? OrderStatus.CANCELLED,
      });
      this.cancelOpen.set(false);
    } catch (error) {
      if (error instanceof OrderApiError && error.status === 401) {
        this.cancelOpen.set(false);
        await this.router.navigate(['/login'], {
          queryParams: { redirect: `/my-orders/${current.id}`, reason: 'expired' },
        });
        return;
      }
      this.cancelError.set(
        error instanceof OrderApiError && error.message
          ? error.message
          : CANCEL_FAILED_MESSAGE
      );
    } finally {
      this.cancelling.set(false);
    }
  }

  onGcashSubmitted(event: { paymentStatus: string }): void {
    const current = this.order();
    if (current) {
      this.order.set({ ...current, paymentStatus: event.paymentStatus as PaymentStatus });
    }
  }

  async onGcashSessionExpired(): Promise<void> {
    await this.router.navigate(['/login'], {
      queryParams: { redirect: `/my-orders/${this.id()}`, reason: 'expired' },
    });
  }

  shortId(orderId: string): string {
    return orderId ? orderId.slice(0, 8) : '';
  }

  orderDate(order: Order): string {
    return formatOrderDate(order.createdAt);
  }

  statusLabel(order: Order): string {
    return orderStatusLabel(order.orderStatus);
  }

  statusClass(order: Order): string {
    return orderStatusClass(order.orderStatus);
  }

  paymentLabel(order: Order): string {
    return paymentStatusLabel(order.paymentStatus);
  }

  paymentClass(order: Order): string {
    return paymentStatusClass(order.paymentStatus);
  }

  paymentMethod(order: Order): string {
    return paymentMethodLabel(order.paymentMethod);
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  formatPrice(value: number): string {
    return formatOrderPrice(value);
  }
}
