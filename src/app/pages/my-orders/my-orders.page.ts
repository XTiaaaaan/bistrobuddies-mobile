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
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, receipt } from 'ionicons/icons';
import { catchError, distinctUntilChanged, of, switchMap } from 'rxjs';
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

export type MyOrdersStatus = 'loading' | 'ready' | 'empty' | 'error';

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

  constructor() {
    addIcons({ alertCircle, receipt });
  }

  ngOnInit(): void {
    this.authService.uid$
      .pipe(
        distinctUntilChanged(),
        switchMap((uid) => {
          if (!uid) {
            this.status.set('error');
            return of<Order[] | null>(null);
          }

          this.status.set('loading');
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
        if (!orders) {
          return;
        }
        this.orders.set(orders);
        this.status.set(orders.length > 0 ? 'ready' : 'empty');
      });
  }

  shortId(orderId: string): string {
    return orderId ? orderId.slice(0, 8) : '';
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

  formatPrice(value: number): string {
    return formatOrderPrice(value);
  }
}
