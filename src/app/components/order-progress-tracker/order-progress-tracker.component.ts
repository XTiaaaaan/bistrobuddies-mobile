import { Component, computed, input } from '@angular/core';
import {
  buildOrderProgress,
  OrderProgress,
} from '../../core/orders/order-progress';
import { Order } from '../../models/order.model';

@Component({
  selector: 'app-order-progress-tracker',
  templateUrl: './order-progress-tracker.component.html',
  styleUrls: ['./order-progress-tracker.component.scss'],
  standalone: true,
})
export class OrderProgressTrackerComponent {
  readonly order = input.required<Order>();

  readonly progress = computed<OrderProgress>(() =>
    buildOrderProgress(this.order())
  );
}
