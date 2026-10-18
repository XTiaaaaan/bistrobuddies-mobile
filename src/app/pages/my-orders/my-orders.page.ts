import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, receipt } from 'ionicons/icons';
import { catchError, distinctUntilChanged, of, Subscription, switchMap } from 'rxjs';
import {
  formatOrderDate,
  formatOrderPrice,
  orderStatusClass,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusClass,
  paymentStatusLabel,
} from '../../core/orders/order-display';
import { refundDisplay, RefundDisplay } from '../../core/orders/refund-display';
import { RefresherEvent, withRefresh } from '../../core/refresher/refresher';
import { Order } from '../../models/order.model';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';

export type MyOrdersStatus = 'loading' | 'ready' | 'empty' | 'error' | 'signed-out';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.page.html',
  styleUrls: ['./my-orders.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class MyOrdersPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly ordersService = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<MyOrdersStatus>('loading');
  readonly orders = signal<Order[]>([]);

  private ordersSubscription: Subscription | null = null;

  constructor() {
    addIcons({ alertCircle, receipt });
  }

  ngOnInit(): void {
    void this.watchOrders();
  }

  /**
   * (Re)subscribes to the signed-in customer's order stream and resolves on
   * the first snapshot — pull-to-refresh waits for that before it closes the
   * spinner, so the spinner never disappears before the fresh data lands.
   */
  private watchOrders(): Promise<void> {
    this.ordersSubscription?.unsubscribe();

    return new Promise<void>((resolve) => {
      this.ordersSubscription = this.authService.uid$
        .pipe(
          distinctUntilChanged(),
          switchMap((uid) => {
            if (!uid) {
              this.status.set('signed-out');
              return of<Order[] | null>(null);
            }

            // Only the first load swaps in the loading state; a pull-to-refresh
            // keeps the orders already on screen until the fresh snapshot lands.
            if (this.status() !== 'ready' && this.status() !== 'empty') {
              this.status.set('loading');
            }
            return this.ordersService.watchCustomerOrders(uid).pipe(
              catchError(() => {
                this.status.set('error');
                return of(null);
              })
            );
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((orders) => {
          if (orders) {
            this.orders.set(orders);
            this.status.set(orders.length > 0 ? 'ready' : 'empty');
          }
          resolve();
        });
    });
  }

  /** Pull-to-refresh: re-subscribes to the order stream, then closes the spinner. */
  onRefresh(event: RefresherEvent): Promise<void> {
    return withRefresh(event, () => this.watchOrders());
  }

  shortId(orderId: string): string {
    if (!orderId) {
      return '';
    }
    return orderId.length > 16 ? `${orderId.slice(0, 16)}…` : orderId;
  }

  orderDate(order: Order): string {
    return formatOrderDate(order.createdAt);
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
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

  /** Refund facts for a cancelled order; hidden for all other statuses. */
  refund(order: Order): RefundDisplay {
    return refundDisplay(order);
  }

  formatPrice(value: number): string {
    return formatOrderPrice(value);
  }
}
