import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cafe, cart } from 'ionicons/icons';
import { environment } from '../../../environments/environment';
import { formatPeso } from '../../core/format/price';
import { orderStatusLabel, paymentStatusLabel } from '../../core/orders/order-display';
import {
  GCASH_MESSAGES,
  GCASH_QR_ASSET,
  isValidGcashAccountName,
  isValidGcashNumber,
} from '../../core/payment/gcash';
import {
  PAYMENT_PROOF_MESSAGES,
  isPaymentProofFile,
  validatePaymentProof,
} from '../../core/payment/payment-proof';
import { GcashSubmissionFormComponent } from '../../components/gcash-submission-form/gcash-submission-form.component';
import { OrderSuccessComponent } from '../../components/order-success/order-success.component';
import { PaymentProofUploadComponent } from '../../components/payment-proof-upload/payment-proof-upload.component';
import { CartItem } from '../../models/cart.model';
import { OrderStatus } from '../../models/order.model';
import { PaymentMethod, PaymentStatus } from '../../models/payment.model';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import {
  CreateOrderItemRequest,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderApiError,
  OrdersApiService,
  PaymentProofUploadResponse,
} from '../../services/orders-api.service';
import { UsersService } from '../../services/users.service';

type InputEventLike = { detail: { value?: unknown } };

/** Shown when the backend rejects the Bearer token (expired / revoked). */
export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again to place your order.';

/** Mirrors the backend's phone rule so obvious typos fail before the request. */
export const PHONE_PATTERN = /^[0-9+\-()\s]{7,20}$/;

/** Turns a backend order failure into a message the customer can act on. */
export function orderErrorMessage(error: unknown): string {
  if (error instanceof OrderApiError) {
    if (error.status === 404 || error.status === 409) {
      return `${error.message} Update your cart to continue.`;
    }
    if (error.message) {
      return error.message;
    }
  }
  return 'We could not place your order. Please try again.';
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    RouterLink,
    GcashSubmissionFormComponent,
    OrderSuccessComponent,
    PaymentProofUploadComponent,
  ],
})
export class CheckoutPage implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = this.cartService.items;
  readonly subtotal = this.cartService.subtotal;
  readonly deliveryFee = environment.deliveryFee > 0 ? environment.deliveryFee : 0;
  readonly paymentMethods = [
    { value: PaymentMethod.COD, label: 'COD', hint: 'Pay cash when your order arrives.' },
    {
      value: PaymentMethod.GCASH,
      label: 'GCash',
      hint: 'Pay by scanning the QR code shown below and enter your GCash details.',
    },
  ];

  /** Fixed local QR asset; never uploaded to or managed by the backend. */
  readonly gcashQrAsset = GCASH_QR_ASSET;
  readonly gcashMessages = GCASH_MESSAGES;

  readonly name = signal('');
  readonly phone = signal('');
  readonly address = signal('');
  readonly comment = signal('');
  readonly paymentMethod = signal<PaymentMethod>(PaymentMethod.COD);
  /** GCash account details the customer pays with — collected before placing. */
  readonly gcashName = signal('');
  readonly gcashNumber = signal('');
  readonly uid = signal<string | null>(null);
  /** True once the auth state has been resolved at least once. */
  readonly authChecked = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** Authoritative summary returned by the backend after a successful order. */
  readonly placedOrder = signal<CreateOrderResponse | null>(null);
  /**
   * Snapshot of the cart lines that were actually sent, captured before the
   * cart is cleared. The backend response only carries totals, so this is the
   * data used to render the item list on the success screen.
   */
  readonly placedItems = signal<CartItem[]>([]);
  /** Set once the GCash details POST succeeds, so the form is not shown again. */
  readonly gcashDetailsSubmitted = signal(false);
  /** Set when the details POST failed after the order was created (retry). */
  readonly gcashDetailsFailed = signal(false);
  readonly gcashProof = signal<File | null>(null);
  readonly gcashProofUploaded = signal(false);
  readonly gcashProofUploading = signal(false);
  readonly gcashProofFailed = signal(false);
  readonly gcashProofError = signal<string | null>(null);

  readonly isEmpty = computed(() => this.items().length === 0);
  readonly missingName = computed(() => this.name().trim() === '');
  readonly missingPhone = computed(() => this.phone().trim() === '');
  readonly missingAddress = computed(() => this.address().trim() === '');
  readonly invalidPhone = computed(() => {
    const phone = this.phone().trim();
    return phone !== '' && !PHONE_PATTERN.test(phone);
  });
  readonly total = computed(() => this.subtotal() + this.deliveryFee);
  /** Whether GCash is the selected payment method. */
  readonly gcashSelected = computed(() => this.paymentMethod() === PaymentMethod.GCASH);
  /**
   * GCash details must be complete and valid before the order can be placed:
   * the customer cannot finish checkout without providing them.
   */
  readonly gcashDetailsValid = computed(
    () =>
      isValidGcashAccountName(this.gcashName()) &&
      isValidGcashNumber(this.gcashNumber())
  );
  readonly gcashProofReady = computed(() => isPaymentProofFile(this.gcashProof()));
  readonly gcashPaymentComplete = computed(
    () => this.gcashDetailsSubmitted() && this.gcashProofUploaded()
  );
  /** Session expired / signed out while the checkout page was open. */
  readonly signedOut = computed(() => this.authChecked() && this.uid() === null);
  /**
   * The confirmation is only shown right after a successful order while the
   * cart is empty; adding a new item returns the page to the normal flow.
   */
  readonly confirmation = computed(() => (this.isEmpty() ? this.placedOrder() : null));
  /** The payment method the backend confirmed for the placed order. */
  readonly placedPaymentMethod = computed<PaymentMethod | null>(() => {
    const order = this.placedOrder();
    if (!order) {
      return null;
    }
    const method = order.paymentMethod ?? this.paymentMethod();
    return (method as PaymentMethod) ?? null;
  });
  readonly isGcashOrder = computed(
    () => this.placedPaymentMethod() === PaymentMethod.GCASH
  );
  /** Full, customer-friendly label for the method the backend confirmed. */
  readonly placedPaymentMethodLabel = computed(() => {
    switch (this.placedPaymentMethod()) {
      case PaymentMethod.COD:
        return 'Cash on Delivery (COD)';
      case PaymentMethod.GCASH:
        return 'GCash';
      default:
        return '';
    }
  });
  readonly placedItemCount = computed(() =>
    this.placedItems().reduce((sum, item) => sum + item.quantity, 0)
  );
  /**
   * Any difference between the backend's line totals and its final total is a
   * discount. Derived from authoritative response values, never fabricated.
   */
  readonly placedDiscount = computed(() => {
    const order = this.placedOrder();
    if (!order) {
      return 0;
    }
    return Math.max(0, order.subtotal + order.deliveryFee - order.total);
  });
  /** Friendly status line for the freshly created order. */
  readonly orderStatusMessage = computed(() => {
    const order = this.placedOrder();
    if (!order) {
      return '';
    }
    switch (order.orderStatus as OrderStatus) {
      case OrderStatus.PENDING:
        return 'We have received your order and will confirm it with the shop shortly.';
      case OrderStatus.CONFIRMED:
        return 'The shop has confirmed your order and will start preparing it soon.';
      case OrderStatus.PREPARING:
        return 'Your coffee is being prepared. We will keep you posted.';
      case OrderStatus.READY:
        return 'Your order is ready and waiting for the rider.';
      case OrderStatus.OUT_FOR_DELIVERY:
        return 'Your order is on the way. Please keep your phone nearby.';
      case OrderStatus.COMPLETED:
        return 'Your order has been delivered. We hope you enjoy it!';
      case OrderStatus.CANCELLED:
        return 'This order has been cancelled.';
      default:
        return '';
    }
  });
  /**
   * The GCash QR + details form is only shown while the order is still
   * awaiting payment and the details have not been accepted yet.
   */
  readonly showGcashPaymentPanel = computed(() => {
    const order = this.placedOrder();
    if (!order || !this.isGcashOrder()) {
      return false;
    }
    const status = (order.paymentStatus as PaymentStatus) ?? PaymentStatus.PENDING;
    if (status === PaymentStatus.PAID || status === PaymentStatus.REJECTED) {
      return false;
    }
    return !this.gcashPaymentComplete();
  });
  /** Customer-facing message about the GCash payment state during checkout. */
  readonly gcashNotice = computed(() => {
    const order = this.placedOrder();
    if (!order || !this.isGcashOrder()) {
      return null;
    }
    const status = (order.paymentStatus as PaymentStatus) ?? PaymentStatus.PENDING;
    if (status === PaymentStatus.REJECTED) {
      return GCASH_MESSAGES.rejected;
    }
    if (this.gcashPaymentComplete()) {
      return GCASH_MESSAGES.submitted;
    }
    return null;
  });

  readonly canSubmit = computed(
    () =>
      !this.isEmpty() &&
      !this.submitting() &&
      !this.missingName() &&
      !this.missingPhone() &&
      !this.invalidPhone() &&
      !this.missingAddress() &&
      this.uid() !== null &&
      (!this.gcashSelected() ||
        (this.gcashDetailsValid() && this.gcashProofReady()))
  );

  constructor() {
    addIcons({ alertCircle, cafe, cart });
  }

  ngOnInit(): void {
    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.uid.set(user?.uid ?? null);
        this.authChecked.set(true);
        if (user) {
          void this.prefill(user.uid, user.displayName ?? '');
        }
      });
  }

  async prefill(uid: string, displayName: string): Promise<void> {
    if (!this.name().trim() && displayName.trim()) {
      this.name.set(displayName.trim());
    }

    try {
      const profile = await this.usersService.getUser(uid);
      if (!profile) {
        return;
      }
      if (!this.name().trim()) {
        this.name.set(profile.name ?? '');
      }
      if (!this.phone().trim()) {
        this.phone.set(profile.phone ?? '');
      }
      if (!this.address().trim()) {
        this.address.set(profile.address ?? '');
      }
    } catch {
      // Profile details are optional; the customer can type them manually.
    }
  }

  setName(event: InputEventLike): void {
    this.name.set(asText(event));
  }

  setPhone(event: InputEventLike): void {
    this.phone.set(asText(event));
  }

  setAddress(event: InputEventLike): void {
    this.address.set(asText(event));
  }

  setComment(event: InputEventLike): void {
    this.comment.set(asText(event));
  }

  setPaymentMethod(event: InputEventLike): void {
    this.selectPaymentMethod(event.detail.value);
  }

  /**
   * Selects the payment method directly.
   *
   * Ionic no longer selects an `ion-radio` when the surrounding `ion-item`
   * (e.g. its label) is clicked, so the item click handler drives selection
   * while `ion-radio-group`'s `ionChange` still handles keyboard use.
   */
  selectPaymentMethod(value: unknown): void {
    if (value === PaymentMethod.COD || value === PaymentMethod.GCASH) {
      this.paymentMethod.set(value);
    }
  }

  /** Collects the GCash account details typed in the pre-order form. */
  onGcashCollect(event: { accountName: string; accountNumber: string }): void {
    this.gcashName.set(event.accountName);
    this.gcashNumber.set(event.accountNumber);
  }

  onGcashProofSelected(file: File | null): void {
    this.gcashProof.set(file);
    this.gcashProofFailed.set(false);
    this.gcashProofError.set(file ? validatePaymentProof(file) : null);
  }

  /** Called when the GCash submission form reports success. */
  onGcashSubmitted(event: { paymentStatus: string }): void {
    this.gcashDetailsSubmitted.set(true);
    this.gcashDetailsFailed.set(false);
    const current = this.placedOrder();
    if (current) {
      this.placedOrder.set({ ...current, paymentStatus: event.paymentStatus });
    }
  }

  async retryGcashSubmission(): Promise<void> {
    const order = this.placedOrder();
    if (!order || !this.isGcashOrder() || this.gcashPaymentComplete()) {
      return;
    }
    if (this.submitting() || this.gcashProofUploading()) {
      return;
    }

    this.submitting.set(true);
    try {
      await this.submitGcashPaymentFor(order);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Sends the customer to sign in again when their session expired. */
  async onGcashSessionExpired(): Promise<void> {
    await this.router.navigate(['/login'], {
      queryParams: { redirect: '/checkout', reason: 'expired' },
    });
  }

  /**
   * Confirms the order summary with the customer, then places the order.
   * Nothing is sent to the backend until they accept the dialog.
   */
  async confirmAndPlaceOrder(): Promise<void> {
    this.submitted.set(true);
    if (this.submitting() || !this.canSubmit()) {
      return;
    }

    const count = this.items().reduce((sum, item) => sum + item.quantity, 0);
    const method = this.paymentMethods.find((entry) => entry.value === this.paymentMethod());
    const methodLabel = method?.label ?? 'COD';
    const methodHint = method?.hint ?? 'Pay cash when your order arrives.';
    const alert = await this.alertController.create({
      header: 'Place your order?',
      subHeader: `${count} item${count === 1 ? '' : 's'} · Total ${this.formatPrice(this.total())}`,
      message: `Payment: ${methodLabel}\n${methodHint}`,
      cssClass: 'bb-order-alert',
      buttons: [
        {
          text: 'Go Back',
          role: 'cancel',
          cssClass: 'bb-order-cancel',
        },
        {
          text: 'Place Order',
          cssClass: 'bb-order-confirm',
          handler: () => {
            void this.placeOrder();
          },
        },
      ],
    });
    await alert.present();
  }

  async placeOrder(): Promise<string | void> {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.gcashDetailsFailed.set(false);

    if (!this.canSubmit()) {
      return;
    }

    const uid = this.uid();
    if (!uid) {
      return;
    }

    this.submitting.set(true);
    try {
      // Capture the exact lines being sent before the cart is cleared so the
      // success screen can show them even though the backend response only
      // returns totals.
      const placedItems = this.items().map((item) => ({ ...item }));
      const request = this.buildCreateOrderRequest();
      const response = await this.ordersApi.createOrder(request);
      // Only clear the cart after the backend confirms the order, so a failed
      // request never loses the customer's items. The returned id/totals are
      // authoritative and drive the confirmation state.
      this.placedItems.set(placedItems);
      this.cartService.clear();
      this.placedOrder.set(response);
      // A GCash order keeps the customer on this page: the required details
      // were already collected in the form, so they are submitted to the
      // backend immediately. COD orders stay on the success screen, which
      // links to the existing order tracking destination.
      const method = response.paymentMethod ?? request.paymentMethod;
      if (method === PaymentMethod.GCASH) {
        await this.submitGcashPaymentFor(response);
      }
      return response.id;
    } catch (error) {
      if (error instanceof OrderApiError && error.status === 401) {
        this.errorMessage.set(SESSION_EXPIRED_MESSAGE);
        await this.router.navigate(['/login'], {
          queryParams: { redirect: '/checkout', reason: 'expired' },
        });
        return;
      }
      this.errorMessage.set(orderErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private async submitGcashPaymentFor(order: CreateOrderResponse): Promise<void> {
    const details = this.gcashDetailsSubmitted()
      ? Promise.resolve()
      : this.submitGcashDetailsFor(order);
    const proof = this.gcashProofUploaded()
      ? Promise.resolve()
      : this.uploadGcashProofFor(order);
    await Promise.all([details, proof]);
  }

  /**
   * Submits the GCash details collected during checkout for the freshly
   * created order. On failure the order stays retrievable — the confirmation
   * view keeps showing the QR code and a prefilled form so the customer can
   * retry here or later from Order Details.
   */
  private async submitGcashDetailsFor(order: CreateOrderResponse): Promise<void> {
    try {
      const result = await this.ordersApi.submitGcashDetails(order.id, {
        accountName: this.gcashName().trim(),
        accountNumber: this.gcashNumber().trim(),
      });
      this.onGcashSubmitted({ paymentStatus: result.paymentStatus });
    } catch (error) {
      if (error instanceof OrderApiError && error.status === 401) {
        await this.onGcashSessionExpired();
        return;
      }
      this.gcashDetailsFailed.set(true);
    }
  }

  private async uploadGcashProofFor(order: CreateOrderResponse): Promise<void> {
    const file = this.gcashProof();
    const issue = validatePaymentProof(file);
    if (issue || !file) {
      this.gcashProofFailed.set(true);
      this.gcashProofError.set(issue ?? PAYMENT_PROOF_MESSAGES.required);
      return;
    }

    this.gcashProofUploading.set(true);
    this.gcashProofError.set(null);
    try {
      const result = await this.ordersApi.uploadPaymentProof(order.id, file);
      this.applyPaymentProof(result);
    } catch (error) {
      if (error instanceof OrderApiError && error.status === 401) {
        await this.onGcashSessionExpired();
        return;
      }
      this.gcashProofFailed.set(true);
      this.gcashProofError.set(
        error instanceof OrderApiError && error.message
          ? error.message
          : PAYMENT_PROOF_MESSAGES.failed
      );
    } finally {
      this.gcashProofUploading.set(false);
    }
  }

  private applyPaymentProof(result: PaymentProofUploadResponse): void {
    this.gcashProofUploaded.set(true);
    this.gcashProofFailed.set(false);
    this.gcashProofError.set(null);
    const current = this.placedOrder();
    if (current) {
      this.placedOrder.set({
        ...current,
        paymentStatus: result.paymentStatus,
        paymentProof: result.paymentProof,
      });
    }
  }

  /**
   * Builds the order request sent to the backend. Prices, totals, customer
   * identity and status fields are deliberately NOT sent — the backend
   * validates this payload, derives the customer from the verified auth
   * token, and computes all amounts from authoritative product data.
   */
  buildCreateOrderRequest(): CreateOrderRequest {
    const name = this.name().trim();
    const phone = this.phone().trim();
    const address = this.address().trim();

    return {
      items: this.items().map((item) => toOrderItemRequest(item)),
      customer: { name, phone },
      address: {
        recipientName: name,
        phone,
        address,
      },
      customerComment: this.comment().trim(),
      paymentMethod: this.paymentMethod(),
    };
  }

  /** Opens the existing order tracking/details page for the created order. */
  trackOrder(): void {
    const order = this.placedOrder();
    if (!order) {
      return;
    }
    void this.router.navigate(['/my-orders', order.id]);
  }

  /** Returns to the existing storefront without touching the placed order. */
  continueShopping(): void {
    void this.router.navigate(['/products']);
  }

  formatPrice(value: number): string {
    return formatPeso(value);
  }

  paymentStatusText(status: string): string {
    return paymentStatusLabel(status);
  }

  orderStatusText(status: string): string {
    return orderStatusLabel(status as OrderStatus);
  }
}

function toOrderItemRequest(item: CartItem): CreateOrderItemRequest {
  return {
    productId: item.productId,
    size: item.size,
    sugar: item.sugar,
    quantity: item.quantity,
  };
}

function asText(event: InputEventLike): string {
  const value = event.detail.value;
  return typeof value === 'string' ? value : '';
}
