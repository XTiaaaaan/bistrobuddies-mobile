import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  Channel,
  LocalNotifications,
} from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Injectable seams for the native notification plugins. Production uses the
 * real Capacitor plugins; tests override the tokens so no native bridge or
 * network call is required.
 */
export const NATIVE_PUSH_NOTIFICATIONS = new InjectionToken<
  typeof PushNotifications
>('bistrobuddies.notifications.push', {
  factory: () => PushNotifications,
});

export const NATIVE_LOCAL_NOTIFICATIONS = new InjectionToken<
  typeof LocalNotifications
>('bistrobuddies.notifications.local', {
  factory: () => LocalNotifications,
});

export const CAPACITOR_PLATFORM = new InjectionToken<() => string>(
  'bistrobuddies.platform.name',
  { factory: () => () => Capacitor.getPlatform() }
);

/** Android channel used for both foreground local notifications and FCM. */
export const ORDER_NOTIFICATION_CHANNEL_ID = 'bistrobuddies_orders';

export type OrderNotificationType = 'ORDER_STATUS' | 'PAYMENT_DECISION';

export interface OrderNotificationData {
  type: OrderNotificationType;
  orderId: string;
  orderStatus?: string;
  orderStatusLabel?: string;
  paymentStatus?: string;
}

/** Status values are accepted from FCM data, which is always string-typed. */
export function parseOrderNotificationData(
  value: unknown
): OrderNotificationData | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = stringValue(record['type']);
  const orderId = stringValue(record['orderId']);
  if (
    !orderId ||
    (type !== 'ORDER_STATUS' && type !== 'PAYMENT_DECISION')
  ) {
    return null;
  }
  return {
    type,
    orderId,
    ...(stringValue(record['orderStatus'])
      ? { orderStatus: stringValue(record['orderStatus']) }
      : {}),
    ...(stringValue(record['orderStatusLabel'])
      ? { orderStatusLabel: stringValue(record['orderStatusLabel']) }
      : {}),
    ...(stringValue(record['paymentStatus'])
      ? { paymentStatus: stringValue(record['paymentStatus']) }
      : {}),
  };
}

/**
 * Builds the Android channel payload. Called before registering for push so a
 * background FCM notification always has its declared channel available.
 */
export function orderNotificationChannel(): Channel {
  return {
    id: ORDER_NOTIFICATION_CHANNEL_ID,
    name: 'Order updates',
    description: 'Order and payment status updates from BistroBuddies',
    importance: 5,
    visibility: 1,
    sound: 'default',
    vibration: true,
  };
}

/** Stable, positive 31-bit id so repeated updates replace the previous tray entry. */
export function orderNotificationId(data: OrderNotificationData): number {
  const key = `${data.type}:${data.orderId}:${
    data.orderStatus ?? data.paymentStatus ?? ''
  }`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}
