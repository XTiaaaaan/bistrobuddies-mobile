import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
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
import {
  formatOrderDate,
  formatOrderPrice,
  orderStatusClass,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusClass,
  paymentStatusLabel,
} from '../../core/orders/order-display';
import { Order } from '../../models/order.model';
import { AuthService } from '../../services/auth.service';
import { OrdersService } from '../../services/orders.service';

export type OrderDetailsStatus = 'loading' | 'ready' | 'missing' | 'error';

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
  ],
})
export class OrderDetailsPage implements OnInit {
  readonly id = input.required<string>();

  readonly status = signal<OrderDetailsStatus>('loading');
  readonly order = signal<Order | null>(null);

  private readonly authService = inject(AuthService);
  private readonly ordersService = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ alertCircle, cafe, receipt });
  }

  ngOnInit(): void {
    this.authService.uid$
      .pipe(
        distinctUntilChanged(),
        switchMap((uid) => {
          if (!uid) {
            this.status.set('error');
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
