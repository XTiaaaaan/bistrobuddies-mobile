import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';
import { authErrorMessage } from '../../core/auth/auth-errors';
import { redirectTarget } from '../../core/auth/auth-redirect';
import { AuthService } from '../../services/auth.service';

const GOOGLE_TIMEOUT_HINT_MS = 45_000;
const GOOGLE_TIMEOUT_HINT =
  'This is taking longer than usual. Finish the sign-in in the Google window, and make sure pop-ups are allowed for this site.';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonTitle,
    IonToolbar,
  ],
})
export class LoginPage implements OnInit {
  email = '';
  password = '';

  readonly errorMessage = signal('');
  readonly status = signal('');
  readonly googleHint = signal('');
  readonly loading = signal(false);
  readonly googleLoading = signal(false);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private googleHintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    addIcons({ logoGoogle });
  }

  ngOnInit(): void {
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (user && !this.loading() && !this.googleLoading()) {
          void this.goToTarget();
        }
      });
  }

  async signIn(): Promise<void> {
    if (!this.credentialsValid()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.status.set('Signing in...');

    try {
      await this.auth.login(this.email, this.password, (message) =>
        this.status.set(message)
      );
      await this.goToTarget();
    } catch (error) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
      this.status.set('');
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.googleLoading.set(true);
    this.errorMessage.set('');
    this.googleHint.set('');
    this.status.set('Waiting for Google...');
    this.googleHintTimer = setTimeout(() => {
      if (this.googleLoading()) {
        this.googleHint.set(GOOGLE_TIMEOUT_HINT);
      }
    }, GOOGLE_TIMEOUT_HINT_MS);

    try {
      await this.auth.loginWithGoogle((message) => this.status.set(message));
      await this.goToTarget();
    } catch (error) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.clearGoogleHintTimer();
      this.googleLoading.set(false);
      this.status.set('');
      this.googleHint.set('');
    }
  }

  private clearGoogleHintTimer(): void {
    if (this.googleHintTimer !== null) {
      clearTimeout(this.googleHintTimer);
      this.googleHintTimer = null;
    }
  }

  private credentialsValid(): boolean {
    if (!this.email.trim() || !this.password) {
      this.errorMessage.set('Enter your email and password.');
      return false;
    }
    return true;
  }

  private goToTarget(): Promise<boolean> {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    return this.router.navigateByUrl(redirectTarget(redirect), {
      replaceUrl: true,
    });
  }
}
