import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import {
  GCASH_MESSAGES,
  GCASH_SESSION_EXPIRED_MESSAGE,
  isValidGcashAccountName,
  isValidGcashNumber,
} from '../../core/payment/gcash';
import { OrderApiError, OrdersApiService } from '../../services/orders-api.service';

type InputEventLike = { detail: { value?: unknown } };

/**
 * GCash account-details form shared by checkout and order details.
 *
 * Client-side validation only exists for usability; the backend remains the
 * security authority. The form never asks for a GCash PIN, password or OTP.
 *
 * Two modes:
 * - `orderId` set — collects details and POSTs them for that order (submit
 *   button included).
 * - `orderId` empty — collects details before an order exists (checkout):
 *   every keystroke is emitted via `valueChange` and no submit button is
 *   shown; the surrounding page drives the actual request.
 */
@Component({
  selector: 'app-gcash-submission-form',
  templateUrl: './gcash-submission-form.component.html',
  styleUrls: ['./gcash-submission-form.component.scss'],
  standalone: true,
  imports: [IonButton, IonInput, IonSpinner],
})
export class GcashSubmissionFormComponent implements OnInit {
  private readonly ordersApi = inject(OrdersApiService);

  /** Order the details belong to. Empty while collecting pre-order values. */
  readonly orderId = input<string>('');
  /** When set, the fields start from the previous submission values. */
  readonly initialName = input<string>('');
  readonly initialNumber = input<string>('');
  readonly submitLabel = input<string>('Submit Details');

  readonly submitted = output<{ paymentStatus: string }>();
  readonly sessionExpired = output<void>();
  /** Emits the current field values as the customer types (collect mode). */
  readonly valueChange = output<{ accountName: string; accountNumber: string }>();

  readonly accountName = signal('');
  readonly accountNumber = signal('');
  readonly touched = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly invalidName = computed(
    () => this.touched() && !isValidGcashAccountName(this.accountName())
  );
  readonly invalidNumber = computed(
    () => this.touched() && !isValidGcashNumber(this.accountNumber())
  );
  readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      isValidGcashAccountName(this.accountName()) &&
      isValidGcashNumber(this.accountNumber())
  );

  ngOnInit(): void {
    if (!this.accountName()) {
      this.accountName.set(this.initialName());
    }
    if (!this.accountNumber()) {
      this.accountNumber.set(this.initialNumber());
    }
  }

  setName(event: InputEventLike): void {
    this.accountName.set(asText(event));
    this.emitValueChange();
  }

  setNumber(event: InputEventLike): void {
    this.accountNumber.set(asText(event));
    this.emitValueChange();
  }

  private emitValueChange(): void {
    this.valueChange.emit({
      accountName: this.accountName().trim(),
      accountNumber: this.accountNumber().trim(),
    });
  }

  async submit(): Promise<void> {
    this.touched.set(true);
    this.errorMessage.set(null);
    if (!this.canSubmit()) {
      return;
    }
    const orderId = this.orderId();
    if (!orderId) {
      // Collect mode: the surrounding page owns the actual request.
      return;
    }

    this.submitting.set(true);
    try {
      const response = await this.ordersApi.submitGcashDetails(orderId, {
        accountName: this.accountName().trim(),
        accountNumber: this.accountNumber().trim(),
      });
      this.submitted.emit({ paymentStatus: response.paymentStatus });
    } catch (error) {
      if (error instanceof OrderApiError && error.status === 401) {
        this.errorMessage.set(GCASH_SESSION_EXPIRED_MESSAGE);
        this.sessionExpired.emit();
        return;
      }
      this.errorMessage.set(
        error instanceof OrderApiError && error.message
          ? error.message
          : GCASH_MESSAGES.submissionFailed
      );
    } finally {
      this.submitting.set(false);
    }
  }
}

function asText(event: InputEventLike): string {
  const value = event.detail.value;
  return typeof value === 'string' ? value : '';
}
