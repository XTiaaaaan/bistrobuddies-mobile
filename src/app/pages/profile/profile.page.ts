import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, of, switchMap } from 'rxjs';
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
import {
  cacheBustProfilePhotoUrl,
  resolveProfilePhotoUrl,
} from '../../core/profile/profile-photo';
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
 * The first and last name are edited separately and saved both as
 * `firstName`/`lastName` and as the combined `name` used everywhere else in
 * the app (side menu, checkout, orders). The mobile number is stored as the
 * full international value (`+639XXXXXXXXX`) but edited as the 10 digits
 * after the fixed `+63` prefix, so the country code can never be mistyped.
 * Profile pictures are uploaded to the backend and stored as a URL — never
 * as bytes in Firestore.
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
  /** Editable name parts; `name` below is derived from them. */
  readonly firstName = signal('');
  readonly lastName = signal('');
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
  /** Canonical URL last persisted/loaded, without any cache-busting token. */
  private photoSource: string | null = null;
  private photoToken = 0;
  /** Bumped on every local photo change so a late profile read cannot win. */
  private photoWrite = 0;
  /** True once the live Firestore subscription has delivered a document. */
  private liveDocReceived = false;

  /** Full display name derived from the two editable name fields. */
  readonly name = computed(() => `${this.firstName()} ${this.lastName()}`.trim());

  readonly initials = computed(() => {
    const parts = this.name().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  });

  /** Both parts are required so the profile keeps a usable full name. */
  readonly firstNameError = computed<string | null>(() =>
    this.firstName().trim() ? null : 'First name is required.'
  );

  readonly lastNameError = computed<string | null>(() =>
    this.lastName().trim() ? null : 'Last name is required.'
  );

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
    () =>
      this.status() === 'ready' &&
      !this.saving() &&
      this.firstNameError() === null &&
      this.lastNameError() === null &&
      this.phoneError() === null
  );

  constructor() {
    addIcons({ personCircle, camera, alertCircle });
  }

  ngOnInit(): void {
    // The UID is the only identity relevant here; profile-only Auth updates
    // (for example mirroring a new photo into `photoURL`) must not reload the
    // whole page or restart the Firestore listener.
    this.auth.user$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged((a, b) => a?.uid === b?.uid),
        switchMap((user) => {
          if (!user) {
            this.uid = null;
            this.status.set('signed-out');
            return of(null);
          }
          this.uid = user.uid;
          this.liveDocReceived = false;
          this.email.set(user.email ?? '');
          this.applyPhotoSource(user.photoURL);
          void this.loadProfile(user.uid, user.displayName ?? '');
          // Same source of truth as the side menu: live `users/{uid}` data.
          return this.users.watchUser(user.uid).pipe(catchError(() => of(null)));
        })
      )
      .subscribe((doc) => {
        if (!doc) {
          return;
        }
        this.liveDocReceived = true;
        if ('photoUrl' in doc) {
          this.applyPhotoSource(doc.photoUrl);
        }
      });

    // Firestore snapshots can lag behind the local write; apply successful
    // writes immediately so the profile page and side menu stay in step.
    this.users.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ uid, patch }) => {
        if (uid !== this.uid || !('photoUrl' in patch) || this.photoUploading()) {
          return;
        }
        this.photoWrite += 1;
        this.applyPhotoSource(patch.photoUrl, true);
      });
  }

  setFirstName(event: InputEventLike): void {
    this.firstName.set(asText(event));
    this.saved.set(false);
  }

  setLastName(event: InputEventLike): void {
    this.lastName.set(asText(event));
    this.saved.set(false);
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
      this.photoWrite += 1;
      this.applyPhotoSource(null);
      void this.syncAuthPhoto(null);
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
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    if (!firstName || !lastName) {
      // Required-field messages are already rendered under the inputs.
      return;
    }
    if (this.phoneError() !== null) {
      this.phoneTouched.set(true);
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      // Only this customer's own profile fields are written; `role` is
      // deliberately never sent and other fields keep their stored values.
      const name = `${firstName} ${lastName}`;
      await this.users.updateUser(uid, {
        firstName,
        lastName,
        name,
        phone: this.phone() ? `${PHONE_COUNTRY_CODE}${this.phone()}` : '',
        address: this.address().trim(),
      });
      await this.syncAuthName(name);
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

  /**
   * Applies a stored photo URL to the rendered image. When the URL is
   * unchanged (some upload paths reuse it) `refresh` adds a one-off cache
   * token so the WebView fetches the new bytes instead of its cached copy.
   * Repeated snapshots with the same URL keep the existing display URL and
   * never append parameters again.
   */
  private applyPhotoSource(
    rawUrl: string | null | undefined,
    refresh = false
  ): void {
    const source = resolveProfilePhotoUrl(rawUrl);
    if (!source) {
      this.photoSource = null;
      this.photoUrl.set(null);
      return;
    }

    const sameSource = this.photoSource === source;
    this.photoSource = source;
    if (sameSource) {
      if (refresh) {
        this.photoToken += 1;
        this.photoUrl.set(
          cacheBustProfilePhotoUrl(source, `${Date.now()}-${this.photoToken}`)
        );
      }
      return;
    }

    this.photoUrl.set(source);
  }

  private async uploadPhoto(file: File): Promise<void> {
    const uid = this.uid;
    // The file input and buttons are disabled while uploading, but this guard
    // also protects programmatic double submissions.
    if (!uid || this.photoUploading()) {
      return;
    }

    const previousSource = this.photoSource;
    const previousDisplay = this.photoUrl();
    let uploaded = false;

    this.photoUploading.set(true);
    this.photoError.set(null);
    try {
      const uploadedUrl = await this.profileApi.uploadPhoto(file);
      const source = resolveProfilePhotoUrl(uploadedUrl);
      if (!source) {
        throw new Error('The server did not return an image URL.');
      }
      uploaded = true;

      // Show the new picture as soon as the upload succeeds, without waiting
      // for Firestore to acknowledge or for Firebase Auth to mirror the URL.
      this.applyPhotoSource(source, true);
      this.photoWrite += 1;

      try {
        // Only the photo field is patched, so name, email, phone, address and
        // role keep their stored values.
        await this.users.updateUser(uid, { photoUrl: source });
      } catch (error) {
        // The photo was never persisted: restore the last saved picture
        // instead of pretending the upload replaced it.
        this.photoSource = previousSource;
        this.photoUrl.set(previousDisplay);
        throw error;
      }

      // Best-effort mirror; the Firestore copy is the source of truth.
      void this.syncAuthPhoto(source);
      await this.toast('Profile picture updated.');
    } catch (error) {
      this.photoError.set(
        uploaded
          ? 'Your photo uploaded, but we could not save it to your profile. Please check your connection and try again.'
          : error instanceof Error && error.message
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

  /**
   * Mirrors the full name into Firebase Auth (dashboard greeting, and the
   * profile sync that runs on every login). Firestore already holds the name
   * at this point, so a failure here must not surface as a save error.
   */
  private async syncAuthName(name: string): Promise<void> {
    try {
      await this.auth.setDisplayName(name);
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
    const photoWriteAtStart = this.photoWrite;
    try {
      const doc = await this.users.getUser(uid);
      // Legacy profiles only store the combined `name`; split it so the two
      // inputs stay editable, then prefer the dedicated parts when present.
      const parts = splitName((doc?.name ?? displayName ?? '').trim());
      this.firstName.set((doc?.firstName ?? '').trim() || parts.first);
      this.lastName.set((doc?.lastName ?? '').trim() || parts.last);
      if (!this.email().trim()) {
        this.email.set(doc?.email ?? '');
      }
      this.phone.set(toMobileDigits(doc?.phone ?? ''));
      this.phoneTouched.set(false);
      this.address.set(doc?.address ?? '');

      // The live subscription is authoritative for the photo. Only use this
      // one-time read as a fallback when no snapshot has arrived yet, and
      // never let a late read replace a photo saved during the request.
      if (
        doc &&
        'photoUrl' in doc &&
        !this.liveDocReceived &&
        this.photoWrite === photoWriteAtStart
      ) {
        this.applyPhotoSource(doc.photoUrl);
      }

      this.status.set('ready');
    } catch {
      const parts = splitName(displayName.trim());
      this.firstName.set(parts.first);
      this.lastName.set(parts.last);
      this.status.set('error');
    }
  }
}

function asText(event: InputEventLike): string {
  const value = event.detail.value;
  return typeof value === 'string' ? value : '';
}

/**
 * Splits a stored full name onto the editable first/last parts: the first
 * word becomes the first name and everything after it the last name, so
 * multi-word surnames such as `dela Cruz` survive the round trip.
 */
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: '', last: '' };
  }
  return { first: parts[0], last: parts.slice(1).join(' ') };
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
