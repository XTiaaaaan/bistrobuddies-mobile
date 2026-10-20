import { Component, OnDestroy, computed, output, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeCircle, cloudUpload } from 'ionicons/icons';
import {
  PAYMENT_PROOF_ACCEPT_ATTR,
  validatePaymentProof,
} from '../../core/payment/payment-proof';

@Component({
  selector: 'app-payment-proof-upload',
  templateUrl: './payment-proof-upload.component.html',
  styleUrls: ['./payment-proof-upload.component.scss'],
  standalone: true,
  imports: [IonButton, IonIcon],
})
export class PaymentProofUploadComponent implements OnDestroy {
  readonly fileSelected = output<File | null>();

  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly accept = PAYMENT_PROOF_ACCEPT_ATTR;
  readonly fileName = computed(() => this.selectedFile()?.name ?? '');
  readonly hasFile = computed(() => this.selectedFile() !== null);

  constructor() {
    addIcons({ closeCircle, cloudUpload });
  }

  choose(input: HTMLInputElement): void {
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    const issue = validatePaymentProof(file);
    if (issue) {
      this.errorMessage.set(issue);
      return;
    }

    this.releasePreview();
    this.selectedFile.set(file);
    this.previewUrl.set(createPreviewUrl(file));
    this.errorMessage.set(null);
    this.fileSelected.emit(file);
  }

  remove(): void {
    this.releasePreview();
    this.selectedFile.set(null);
    this.errorMessage.set(null);
    this.fileSelected.emit(null);
  }

  ngOnDestroy(): void {
    this.releasePreview();
  }

  private releasePreview(): void {
    revokePreviewUrl(this.previewUrl());
    this.previewUrl.set(null);
  }
}

function createPreviewUrl(file: File): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }
  return URL.createObjectURL(file);
}

function revokePreviewUrl(url: string | null): void {
  if (
    url &&
    typeof URL !== 'undefined' &&
    typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(url);
  }
}
