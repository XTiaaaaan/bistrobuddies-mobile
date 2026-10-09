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
import { personCircle } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { UsersService } from '../../services/users.service';

type InputEventLike = { detail: { value?: unknown } };

export type ProfileStatus = 'loading' | 'ready' | 'signed-out' | 'error';

/**
 * Private customer profile. Reached only through the guarded `/profile` route;
 * it reads and updates the caller's own `users/{uid}` document (never `role`).
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
  readonly phone = signal('');
  readonly address = signal('');
  readonly photoUrl = signal<string | null>(null);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  private uid: string | null = null;

  readonly initials = computed(() => {
    const parts = this.name().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  });

  readonly canSave = computed(() => this.status() === 'ready' && !this.saving());

  constructor() {
    addIcons({ personCircle });
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
        this.photoUrl.set(user.photoURL ?? null);
        void this.loadProfile(user.uid, user.displayName ?? '');
      });
  }

  setPhone(event: InputEventLike): void {
    this.phone.set(asText(event));
    this.saved.set(false);
  }

  setAddress(event: InputEventLike): void {
    this.address.set(asText(event));
    this.saved.set(false);
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

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      // Only contact details are written; `role` is deliberately never sent.
      await this.users.updateUser(uid, {
        phone: this.phone().trim(),
        address: this.address().trim(),
      });
      this.saved.set(true);

      const toast = await this.toastController.create({
        message: 'Your profile has been saved.',
        duration: 2000,
        position: 'bottom',
        color: 'success',
      });
      await toast.present();
    } catch {
      this.errorMessage.set(
        'We could not save your profile. Please check your connection and try again.'
      );
    } finally {
      this.saving.set(false);
    }
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
      this.phone.set(doc?.phone ?? '');
      this.address.set(doc?.address ?? '');
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
