import { Order, OrderStatus } from '../../models/order.model';
import { ORDER_STATUS_LABELS } from './order-display';

export type FulfillmentType = 'DELIVERY';

export type OrderProgressState = 'complete' | 'current' | 'upcoming';

export interface OrderProgressStage {
  status: OrderStatus;
  label: string;
  state: OrderProgressState;
}

export interface OrderProgress {
  fulfillmentType: FulfillmentType;
  stages: OrderProgressStage[];
  /** The latest status maps to a stage in the tracker. */
  current: OrderStatus | null;
  /** Placed but not confirmed yet: no tracker stage is active. */
  pending: boolean;
  cancelled: boolean;
  /** The backend returned a status this app does not recognise. */
  unknown: boolean;
}

/**
 * Every BistroBuddies order is a delivery order, so the tracker always follows
 * the full backend sequence. READY is never treated as the final stage.
 */
export const DELIVERY_PROGRESS_STAGES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.COMPLETED,
];

export function buildOrderProgress(
  order: Pick<Order, 'orderStatus'>
): OrderProgress {
  const status = order.orderStatus;

  if (status === OrderStatus.CANCELLED) {
    return {
      fulfillmentType: 'DELIVERY',
      stages: [],
      current: null,
      pending: false,
      cancelled: true,
      unknown: false,
    };
  }

  const currentIndex = DELIVERY_PROGRESS_STAGES.indexOf(status);
  const pending = status === OrderStatus.PENDING;
  const unknown = currentIndex < 0 && !pending;
  const stages = DELIVERY_PROGRESS_STAGES.map(
    (stageStatus, index): OrderProgressStage => {
      let state: OrderProgressState = 'upcoming';
      if (currentIndex >= 0) {
        if (index < currentIndex || status === OrderStatus.COMPLETED) {
          state = 'complete';
        } else if (index === currentIndex) {
          state = 'current';
        }
      }
      return {
        status: stageStatus,
        label: ORDER_STATUS_LABELS[stageStatus],
        state,
      };
    }
  );

  return {
    fulfillmentType: 'DELIVERY',
    stages,
    current: currentIndex >= 0 ? status : null,
    pending,
    cancelled: false,
    unknown,
  };
}
