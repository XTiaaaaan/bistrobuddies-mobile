import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, camera, personCircle } from 'ionicons/icons';
import { resolveProductImageUrl } from '../../core/products/product-image';
import { AuthService } from '../../services/auth.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { UsersService } from '../../services/users.service';

type InputEventLike = { detail: { value?: unknown } };

export type ProfileStatus = 'loading' | 'ready' | 'signed-out' | 'error';

/** Country code shown before the mobile number (Philippines). */
export const PHONE_COUNTRY_CODE = '+63';

/** Digits typed after +63 (9XXXXXXXXX) — the input's hard limit. */
export const PHONE_MAX_DIGITS = 10;

/** Philippine mobile numbers: 10 digits starting with 9. */
const PHILIPPINE_MOBILE = /^9\d{9}$/;

/**
 * Private customer profile. Reached only through the guarded `/profile` route;
 * it reads and updates the caller's own `users/{uid}` document (never `role`).
 *
 * The mobile number is stored as the full international value
 * (`+639XXXXXXXXX`) but edited as the 10 digits after the fixed `+63` prefix,
 * so the country code can never be mistyped. Profile pictures are uploaded to
 * the backend and stored as a URL — never as bytes in Firestore.
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonMenuButton,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class ProfilePage implements OnInit {
  readonly status = signal<ProfileStatus>('loading');
  readonly name = signal('');
  readonly email = signal('');
  /** National mobile digits only (no +63), e.g. `9171234567`. */
  readonly phone = signal('');
  readonly address = signal('');
  readonly photoUrl = signal<string | null>(null);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** True while the file picker/upload for the profile picture is running. */
  readonly photoUploading = signal(false);
  readonly photoError = signal<string | null>(null);

  /** Set once the mobile field has been interacted with (e.g. blurred). */
  readonly phoneTouched = signal(false);

  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly profileApi = inject(ProfileApiService);
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  private uid: string | null = null;

  readonly initials = computed(() => {
    const parts = this.name().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  });

  /** `null` when the number is empty (optional) or a valid PH mobile number. */
  readonly phoneError = computed<string | null>(() => {
    const digits = this.phone();
    if (digits === '' || PHILIPPINE_MOBILE.test(digits)) {
      return null;
    }
    return 'Enter a valid mobile number — 10 digits starting with 9 (e.g. 917 123 4567).';
  });

  /** The validation message to render: only after the field was used. */
  readonly showPhoneError = computed(
    () =>
      this.phoneError() !== null &&
      (this.phoneTouched() || this.phone().length >= PHONE_MAX_DIGITS)
  );

  readonly canSave = computed(
    () => this.status() === 'ready' && !this.saving() && this.phoneError() === null
  );

  constructor() {
    addIcons({ personCircle, camera, alertCircle });
  }

  ngOnInit(): void {
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (!user) {
          this.uid = null;
          this.status.set('signed-out');
          return;
        }
        this.uid = user.uid;
        this.email.set(user.email ?? '');
        this.photoUrl.set(resolveProductImageUrl(user.photoURL) || null);
        void this.loadProfile(user.uid, user.displayName ?? '');
      });
  }

  setPhone(event: InputEventLike): void {
    // Keeps digits only, accepts pasted 09…/+63 formats and enforces the
    // 10-digit limit — the value can never grow past PHONE_MAX_DIGITS.
    this.phone.set(toMobileDigits(asText(event)));
    this.saved.set(false);
  }

  markPhoneTouched(): void {
    this.phoneTouched.set(true);
  }

  setAddress(event: InputEventLike): void {
    this.address.set(asText(event));
    this.saved.set(false);
  }

  /** Opens the native file picker for a new profile picture. */
  pickPhoto(input: HTMLInputElement): void {
    if (!this.photoUploading()) {
      input.click();
    }
  }

  /** Uploads the chosen picture, then stores its URL in Firestore + Auth. */
  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    const issue = this.profileApi.validate(file);
    if (issue) {
      this.photoError.set(issue);
      return;
    }
    await this.uploadPhoto(file);
  }

  /** Deletes the current picture; the initials fallback shows again. */
  async removePhoto(): Promise<void> {
    const uid = this.uid;
    if (!uid || this.photoUploading() || !this.photoUrl()) {
      return;
    }

    this.photoUploading.set(true);
    this.photoError.set(null);
    try {
      await this.users.updateUser(uid, { photoUrl: null });
      await this.syncAuthPhoto(null);
      this.photoUrl.set(null);
      await this.toast('Profile picture removed.');
    } catch {
      this.photoError.set(
        'We could not remove your profile picture. Please check your connection and try again.'
      );
    } finally {
      this.photoUploading.set(false);
    }
  }

  /** Reloads the profile after a network failure. */
  retry(): void {
    if (this.uid) {
      void this.loadProfile(this.uid, this.name());
    }
  }

  async save(): Promise<void> {
    const uid = this.uid;
    if (!uid || this.saving()) {
      return;
    }
    if (this.phoneError() !== null) {
      this.phoneTouched.set(true);
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      // Only contact details are written; `role` is deliberately never sent.
      await this.users.updateUser(uid, {
        phone: this.phone() ? `${PHONE_COUNTRY_CODE}${this.phone()}` : '',
        address: this.address().trim(),
      });
      this.saved.set(true);

      await this.toast('Your profile has been saved.');
    } catch {
      this.errorMessage.set(
        'We could not save your profile. Please check your connection and try again.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async uploadPhoto(file: File): Promise<void> {
    const uid = this.uid;
    if (!uid) {
      return;
    }

    this.photoUploading.set(true);
    this.photoError.set(null);
    try {
      const url = await this.profileApi.uploadPhoto(file);
      await this.users.updateUser(uid, { photoUrl: url });
      await this.syncAuthPhoto(url);
      this.photoUrl.set(url);
      await this.toast('Profile picture updated.');
    } catch (error) {
      this.photoError.set(
        error instanceof Error && error.message
          ? error.message
          : 'We could not upload your profile picture. Please try again.'
      );
    } finally {
      this.photoUploading.set(false);
    }
  }

  /**
   * Mirrors the photo URL into Firebase Auth (side menu avatar). Firestore
   * already holds the URL at this point, so a failure here must not surface
   * as an upload error.
   */
  private async syncAuthPhoto(url: string | null): Promise<void> {
    try {
      await this.auth.setPhotoUrl(url);
    } catch {
      // Best-effort only — the Firestore copy is the source of truth.
    }
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }

  private async loadProfile(uid: string, displayName: string): Promise<void> {
    this.status.set('loading');
    try {
      const doc = await this.users.getUser(uid);
      const name = (doc?.name ?? displayName ?? '').trim();
      this.name.set(name);
      if (!this.email().trim()) {
        this.email.set(doc?.email ?? '');
      }
      this.phone.set(toMobileDigits(doc?.phone ?? ''));
      this.phoneTouched.set(false);
      this.address.set(doc?.address ?? '');

      const storedPhoto = resolveProductImageUrl(doc?.photoUrl);
      if (storedPhoto) {
        this.photoUrl.set(storedPhoto);
      }

      this.status.set('ready');
    } catch {
      this.name.set(displayName.trim());
      this.status.set('error');
    }
  }
}

function asText(event: InputEventLike): string {
  const value = event.detail.value;
  return typeof value === 'string' ? value : '';
}

/**
 * Normalizes any stored phone value onto the 10 digits shown after `+63`:
 * `+639171234567` / `09171234567` / `9171234567` all become `9171234567`.
 * Anything else keeps its digits (truncated) so the user can fix it.
 */
function toMobileDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (/^639\d{9}$/.test(digits)) {
    return digits.slice(2);
  }
  if (/^09\d{9}$/.test(digits)) {
    return digits.slice(1);
  }
  if (/^9\d{9}$/.test(digits)) {
    return digits;
  }
  return digits.slice(0, PHONE_MAX_DIGITS);
}
