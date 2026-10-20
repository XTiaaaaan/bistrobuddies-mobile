import { Order, OrderStatus } from '../../models/order.model';
import { ORDER_STATUS_LABELS } from './order-display';

export type FulfillmentType = 'DELIVERY' | 'PICKUP';

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

/** Mirrors the backend: pickup orders never pass through On the Way. */
export const DELIVERY_PROGRESS_STAGES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.COMPLETED,
];

export const PICKUP_PROGRESS_STAGES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
];

/**
 * Resolves how an order is fulfilled.
 *
 * Newer documents may carry an explicit `fulfillmentType`. Historic documents
 * predate that field, and the current checkout is delivery-only, so a present
 * delivery address is the fallback signal; a missing address means pickup.
 */
export function resolveFulfillmentType(
  order: Pick<Order, 'fulfillmentType' | 'addressSnapshot'>
): FulfillmentType {
  const explicit = normalizeFulfillmentType(order.fulfillmentType);
  if (explicit) {
    return explicit;
  }
  const address = order.addressSnapshot?.address?.trim();
  return address ? 'DELIVERY' : 'PICKUP';
}

export function buildOrderProgress(
  order: Pick<
    Order,
    'orderStatus' | 'fulfillmentType' | 'addressSnapshot'
  >
): OrderProgress {
  const status = order.orderStatus;
  const fulfillmentType =
    status === OrderStatus.OUT_FOR_DELIVERY
      ? 'DELIVERY'
      : resolveFulfillmentType(order);
  const sequence =
    fulfillmentType === 'DELIVERY'
      ? DELIVERY_PROGRESS_STAGES
      : PICKUP_PROGRESS_STAGES;

  if (status === OrderStatus.CANCELLED) {
    return {
      fulfillmentType,
      stages: [],
      current: null,
      pending: false,
      cancelled: true,
      unknown: false,
    };
  }

  const currentIndex = sequence.indexOf(status);
  const pending = status === OrderStatus.PENDING;
  const unknown = currentIndex < 0 && !pending;
  const stages = sequence.map((stageStatus, index): OrderProgressStage => {
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
  });

  return {
    fulfillmentType,
    stages,
    current: currentIndex >= 0 ? status : null,
    pending,
    cancelled: false,
    unknown,
  };
}

function normalizeFulfillmentType(
  value: string | null | undefined
): FulfillmentType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (
    normalized === 'PICKUP' ||
    normalized === 'SELFCOLLECT' ||
    normalized === 'SELFCOLLECTION' ||
    normalized === 'COLLECT'
  ) {
    return 'PICKUP';
  }
  if (
    normalized === 'DELIVERY' ||
    normalized === 'DELIVER' ||
    normalized === 'SHIPPING' ||
    normalized === 'COURIER'
  ) {
    return 'DELIVERY';
  }
  return null;
}
