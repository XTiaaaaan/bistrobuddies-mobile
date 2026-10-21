import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cafe, checkmark } from 'ionicons/icons';
import { formatPeso } from '../../core/format/price';
import { CartItem } from '../../models/cart.model';
import { CreateOrderResponse } from '../../services/orders-api.service';

/** The backend-confirmed totals needed by the success screen. */
export type OrderSuccessSummary = Pick<
  CreateOrderResponse,
  'id' | 'subtotal' | 'deliveryFee' | 'total'
>;

/**
 * Coffee-themed confirmation shown after the backend accepts an order.
 *
 * It is presentation-only: the checkout page owns order creation, GCash
 * submission and navigation, and projects those extra controls into the
 * `order-success-extra` slot so payment behaviour stays untouched.
 */
@Component({
  selector: 'app-order-success',
  templateUrl: './order-success.component.html',
  styleUrls: ['./order-success.component.scss'],
  standalone: true,
  imports: [IonButton, IonIcon],
})
export class OrderSuccessComponent {
  readonly order = input.required<OrderSuccessSummary>();
  readonly items = input<CartItem[]>([]);
  readonly itemCount = input(0);
  readonly paymentMethodLabel = input('');
  readonly paymentStatusLabel = input('');
  readonly orderStatusLabel = input('');
  readonly statusMessage = input('');
  readonly isGcash = input(false);
  readonly discount = input(0);

  readonly track = output<void>();
  readonly continueShopping = output<void>();

  constructor() {
    addIcons({ cafe, checkmark });
  }

  formatPrice(value: number): string {
    return formatPeso(value);
  }

  /** Size, sugar (when set) and quantity for a placed order line. */
  itemMeta(item: CartItem): string {
    const parts: string[] = [item.size];
    if (item.sugar.trim()) {
      parts.push(item.sugar);
    }
    parts.push(`x${item.quantity}`);
    return parts.join(' · ');
  }
}
