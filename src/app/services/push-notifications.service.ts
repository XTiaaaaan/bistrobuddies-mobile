import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { PluginListenerHandle } from '@capacitor/core';
import type { ActionPerformed as LocalActionPerformed } from '@capacitor/local-notifications';
import type {
  ActionPerformed as PushActionPerformed,
  PushNotificationSchema,
  Token,
} from '@capacitor/push-notifications';
import { distinctUntilChanged } from 'rxjs';
import { IS_NATIVE_PLATFORM } from '../core/auth/google-sign-in';
import {
  CAPACITOR_PLATFORM,
  NATIVE_LOCAL_NOTIFICATIONS,
  NATIVE_PUSH_NOTIFICATIONS,
  ORDER_NOTIFICATION_CHANNEL_ID,
  OrderNotificationData,
  orderNotificationChannel,
  orderNotificationFallbackTitle,
  orderNotificationId,
  parseOrderNotificationData,
} from '../core/notifications/notifications';
import { AuthService } from './auth.service';
import {
  DevicePlatform,
  NotificationsApiService,
} from './notifications-api.service';
import { OrdersService } from './orders.service';

export type NotificationPermission =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unavailable';

interface StoredDeviceToken {
  token: string;
  uid: string;
}

const TOKEN_STORAGE_KEY = 'bistrobuddies.push.device-token';

/**
 * Wires Firebase Cloud Messaging into the customer app.
 *
 * - Requests notification permission only when a customer is signed in.
 * - Registers/refreshes the FCM token with the backend.
 * - Removes the token on logout (before Firebase sign-out).
 * - Shows order updates as local notifications while the app is foregrounded.
 * - Opens the order's details page when a notification is tapped, but only if
 *   the order belongs to the signed-in customer.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(NotificationsApiService);
  private readonly orders = inject(OrdersService);
  private readonly router = inject(Router);
  private readonly isNativePlatform = inject(IS_NATIVE_PLATFORM);
  private readonly platformName = inject(CAPACITOR_PLATFORM);
  private readonly push = inject(NATIVE_PUSH_NOTIFICATIONS);
  private readonly local = inject(NATIVE_LOCAL_NOTIFICATIONS);
  private readonly destroyRef = inject(DestroyRef);

  /** Exposed for diagnostics and future permission UI. */
  readonly permission = signal<NotificationPermission>('unknown');

  private initialized = false;
  private requestedThisSession = false;
  private activeUid: string | null = null;
  private storedToken: StoredDeviceToken | null = null;
  private registeredThisSession: StoredDeviceToken | null = null;
  private pendingNotification: OrderNotificationData | null = null;
  private listenersReady: Promise<void> | null = null;
  private readonly handles: PluginListenerHandle[] = [];

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.storedToken = readStoredToken();

    if (!this.isNativePlatform()) {
      this.permission.set('unavailable');
      return;
    }

    this.listenersReady = this.attachListeners().catch((error) => {
      console.warn('Could not attach push notification listeners.', error);
    });
    this.destroyRef.onDestroy(() => {
      for (const handle of this.handles) {
        void handle.remove();
      }
    });

    this.auth.uid$
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((uid) => {
        this.activeUid = uid;
        if (!uid) {
          // The explicit logout path removes the backend token before
          // sign-out; this only clears any stale local copy.
          this.storedToken = null;
          this.registeredThisSession = null;
          removeStoredToken();
          return;
        }
        void this.startForUser(uid);
        void this.flushPendingNotification();
      });
  }

  /**
   * Called before Firebase sign-out so the backend still has a valid ID token
   * with which to authorize the token removal.
   */
  async unregisterCurrentDevice(): Promise<void> {
    const stored = this.storedToken;
    this.storedToken = null;
    this.registeredThisSession = null;
    removeStoredToken();
    if (!stored || !this.isNativePlatform()) {
      return;
    }
    if (this.activeUid && stored.uid !== this.activeUid) {
      return;
    }
    try {
      await this.api.removeDeviceToken(stored.token);
    } catch (error) {
      console.warn('Could not remove the device token.', error);
    }
  }

  private async startForUser(uid: string): Promise<void> {
    await this.listenersReady;
    if (this.activeUid !== uid) {
      return;
    }

    const granted = await this.ensurePermission();
    if (!granted || this.activeUid !== uid) {
      return;
    }

    await this.ensureChannel();
    try {
      // Resolves through the `registration` listener with a fresh token.
      await this.push.register();
    } catch (error) {
      console.warn('Could not register for push notifications.', error);
    }
  }

  private async ensurePermission(): Promise<boolean> {
    try {
      let state = (await this.push.checkPermissions()).receive;
      if (!this.requestedThisSession) {
        this.requestedThisSession = true;
        if (state === 'prompt' || state === 'prompt-with-rationale') {
          state = (await this.push.requestPermissions()).receive;
        }
      }
      this.permission.set(
        state === 'granted'
          ? 'granted'
          : state === 'denied'
            ? 'denied'
            : 'prompt'
      );
      return state === 'granted';
    } catch (error) {
      console.warn('Could not request notification permission.', error);
      this.permission.set('denied');
      return false;
    }
  }

  private async ensureChannel(): Promise<void> {
    if (this.platformName() !== 'android') {
      return;
    }
    try {
      await this.local.createChannel(orderNotificationChannel());
    } catch (error) {
      console.warn('Could not create the order notification channel.', error);
    }
  }

  private attachListeners(): Promise<void> {
    return Promise.all([
      this.push.addListener('registration', (token: Token) => {
        void this.onRegistration(token.value);
      }),
      this.push.addListener('registrationError', (error) => {
        console.warn('Push notification registration failed.', error.error);
      }),
      this.push.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          void this.showForegroundNotification(notification);
        }
      ),
      this.push.addListener(
        'pushNotificationActionPerformed',
        (action: PushActionPerformed) => {
          void this.openNotificationOrder(action.notification.data);
        }
      ),
      this.local.addListener(
        'localNotificationActionPerformed',
        (action: LocalActionPerformed) => {
          void this.openNotificationOrder(action.notification.extra);
        }
      ),
    ]).then((handles) => {
      this.handles.push(...handles);
    });
  }

  private async onRegistration(value: string): Promise<void> {
    const token = value.trim();
    const uid = this.activeUid;
    if (!token || !uid) {
      return;
    }
    if (
      this.registeredThisSession?.token === token &&
      this.registeredThisSession.uid === uid
    ) {
      return;
    }

    try {
      await this.api.registerDeviceToken(token, this.devicePlatform());
      if (this.activeUid !== uid) {
        return;
      }
      this.registeredThisSession = { token, uid };
      this.storedToken = this.registeredThisSession;
      writeStoredToken(this.storedToken);
    } catch (error) {
      console.warn('Could not register the device token.', error);
    }
  }

  private async showForegroundNotification(
    notification: PushNotificationSchema
  ): Promise<void> {
    const data = parseOrderNotificationData(notification.data);
    if (!data) {
      return;
    }

    try {
      await this.local.schedule({
        notifications: [
          {
            id: orderNotificationId(data),
            title:
              notification.title?.trim() ||
              orderNotificationFallbackTitle(data),
            body:
              notification.body?.trim() ||
              'Your BistroBuddies order was updated.',
            channelId: ORDER_NOTIFICATION_CHANNEL_ID,
            extra: { ...data },
          },
        ],
      });
    } catch (error) {
      console.warn('Could not show the foreground notification.', error);
    }
  }

  private async openNotificationOrder(value: unknown): Promise<void> {
    const data = parseOrderNotificationData(value);
    if (!data) {
      return;
    }
    if (!this.activeUid) {
      // A cold-start tap can reach the listener before Firebase restores the
      // session. Keep the order id until auth is ready.
      this.pendingNotification = data;
      return;
    }

    const uid = this.activeUid;
    try {
      const order = await this.orders.getOrder(data.orderId);
      // A shared device or stale notification must never expose someone
      // else's order, even though the route itself is guarded.
      if (!order || order.customerId !== uid) {
        return;
      }
      if (this.router.url === `/my-orders/${data.orderId}`) {
        return;
      }
      await this.router.navigate(['/my-orders', data.orderId]);
    } catch (error) {
      console.warn('Could not open the order from the notification.', error);
    }
  }

  private async flushPendingNotification(): Promise<void> {
    const data = this.pendingNotification;
    if (!data || !this.activeUid) {
      return;
    }
    this.pendingNotification = null;
    await this.openNotificationOrder(data);
  }

  private devicePlatform(): DevicePlatform {
    const platform = this.platformName();
    return platform === 'android' || platform === 'ios' || platform === 'web'
      ? platform
      : 'unknown';
  }
}

function readStoredToken(): StoredDeviceToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredDeviceToken>;
    return typeof parsed.token === 'string' &&
      parsed.token &&
      typeof parsed.uid === 'string' &&
      parsed.uid
      ? { token: parsed.token, uid: parsed.uid }
      : null;
  } catch {
    return null;
  }
}

function writeStoredToken(value: StoredDeviceToken): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage is a convenience for logout cleanup, not required at runtime.
  }
}

function removeStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage (e.g. private browsing).
  }
}
