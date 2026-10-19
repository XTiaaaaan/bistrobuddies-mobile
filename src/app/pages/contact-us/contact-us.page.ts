import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
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
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, call, checkmarkCircle, location, mail } from 'ionicons/icons';
import { SignInPromptService } from '../../core/auth/sign-in-prompt.service';
import {
  CONTACT_EMAIL_MAX,
  CONTACT_MESSAGES,
  CONTACT_NAME_MAX,
  CONTACT_SUBJECT_MAX,
  CONTACT_MESSAGE_MAX,
  ContactFormErrors,
  hasContactFormErrors,
  validateContactForm,
} from '../../core/contact/contact-form';
import { AuthService } from '../../services/auth.service';
import {
  ContactApiError,
  ContactMessagesService,
} from '../../services/contact-messages.service';
import { UsersService } from '../../services/users.service';

/** Company contact details shown on this page. */
export const COMPANY_CONTACT = {
  name: 'BistroBuddies',
  address: 'Quezon City, Philippines',
  phone: '09123456789',
  email: 'bistrobuddies@gmail.com',
} as const;

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.page.html',
  styleUrls: ['./contact-us.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
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
export class ContactUsPage implements OnInit {
  /** Single source for the company details rendered by the template. */
  readonly company = COMPANY_CONTACT;

  /** Backend field limits, exposed for the inputs' maxlength. */
  readonly nameMax = CONTACT_NAME_MAX;
  readonly emailMax = CONTACT_EMAIL_MAX;
  readonly subjectMax = CONTACT_SUBJECT_MAX;
  readonly messageMax = CONTACT_MESSAGE_MAX;

  readonly name = signal('');
  readonly email = signal('');
  readonly subject = signal('');
  readonly message = signal('');

  /** True while the auth state has been resolved at least once. */
  readonly authChecked = signal(false);
  readonly signedIn = signal(false);

  readonly submitting = signal(false);
  /** Set only after the backend confirms the message was stored. */
  readonly submitted = signal(false);
  readonly formError = signal<string | null>(null);
  /** True when the last submit attempt was rejected for authentication. */
  readonly authError = signal(false);
  /** Field messages appear once the customer has tried to send the form. */
  readonly showErrors = signal(false);

  readonly fieldErrors = computed<ContactFormErrors>(() =>
    validateContactForm({
      name: this.name(),
      email: this.email(),
      subject: this.subject(),
      message: this.message(),
    })
  );

  /** Field messages appear once the customer has tried to send the form. */
  readonly nameError = computed(() => (this.showErrors() ? this.fieldErrors().name ?? null : null));
  readonly emailError = computed(() => (this.showErrors() ? this.fieldErrors().email ?? null : null));
  readonly subjectError = computed(() => (this.showErrors() ? this.fieldErrors().subject ?? null : null));
  readonly messageError = computed(() => (this.showErrors() ? this.fieldErrors().message ?? null : null));

  /** The submit button stays usable so guests can be prompted to sign in. */
  readonly canSubmit = computed(() => !this.submitting());

  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly contactApi = inject(ContactMessagesService);
  private readonly signInPrompt = inject(SignInPromptService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ call, mail, location, alertCircle, checkmarkCircle });
  }

  ngOnInit(): void {
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.signedIn.set(user !== null);
        this.authChecked.set(true);
        if (!user) {
          return;
        }
        if (!this.email().trim() && user.email) {
          this.email.set(user.email);
        }
        void this.prefillName(user.uid, user.displayName ?? '');
      });
  }

  setName(value: string): void {
    this.name.set(value);
    this.clearSuccess();
  }

  setEmail(value: string): void {
    this.email.set(value);
    this.clearSuccess();
  }

  setSubject(value: string): void {
    this.subject.set(value);
    this.clearSuccess();
  }

  setMessage(value: string): void {
    this.message.set(value);
    this.clearSuccess();
  }

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    this.authError.set(false);

    try {
      // Guests are offered the shared sign-in prompt before any validation or
      // network call happens.
      if (!(await this.signInPrompt.requireSignIn('/contact-us'))) {
        return;
      }

      this.showErrors.set(true);

      if (hasContactFormErrors(this.fieldErrors())) {
        return;
      }

      // Success is only reported once the backend confirms the store (201).
      await this.contactApi.submit({
        name: this.name().trim(),
        email: this.email().trim(),
        subject: this.subject().trim(),
        message: this.message().trim(),
      });
      this.submitted.set(true);
      this.showErrors.set(false);
      // The message itself is done; identity fields stay for the next one.
      this.subject.set('');
      this.message.set('');
    } catch (error) {
      // Entered values are deliberately preserved so nothing has to be retyped.
      const apiError = error instanceof ContactApiError ? error : null;
      this.formError.set(apiError?.message ?? CONTACT_MESSAGES.server);
      this.authError.set(apiError?.status === 401);
    } finally {
      this.submitting.set(false);
    }
  }

  private clearSuccess(): void {
    if (this.submitted()) {
      this.submitted.set(false);
    }
  }

  /**
   * Prefills the sender's name from `users/{uid}` (falling back to the Auth
   * display name) without ever overwriting something already typed.
   */
  private async prefillName(uid: string, displayName: string): Promise<void> {
    try {
      const doc = await this.users.getUser(uid);
      const parts = [doc?.firstName ?? '', doc?.lastName ?? '']
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
      const name = parts || (doc?.name ?? '').trim() || displayName.trim();
      if (!this.name().trim() && name) {
        this.name.set(name);
      }
      if (!this.email().trim() && doc?.email) {
        this.email.set(doc.email);
      }
    } catch {
      // Prefill is a convenience; the form still works without it.
    }
  }
}
