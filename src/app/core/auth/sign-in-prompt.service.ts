import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { catchError, firstValueFrom, of, take } from 'rxjs';
import { AuthService } from '../../services/auth.service';

export const SIGN_IN_REQUIRED_TITLE = 'Sign in required';
export const SIGN_IN_REQUIRED_MESSAGE =
  'Sign in to your BistroBuddies account to access this feature and enjoy ordering your favorite coffee.';

export type SignInPromptResult = 'signed-in' | 'sign-in' | 'dismissed';

/**
 * Single source for the sign-in nudge shown to guests. Every protected
 * feature reuses this service so the copy, buttons and styling stay identical
 * and only one alert can be open at a time.
 */
@Injectable({ providedIn: 'root' })
export class SignInPromptService {
  private readonly auth = inject(AuthService);
  private readonly alertController = inject(AlertController);
  private readonly router = inject(Router);

  /** Shared while an alert is open so rapid taps do not stack prompts. */
  private pending: Promise<SignInPromptResult> | null = null;

  /**
   * Resolves the current auth state and, for guests, presents the prompt.
   * Navigation stays with the caller so guards can return a UrlTree.
   */
  async state(): Promise<SignInPromptResult> {
    if (await this.isSignedIn()) {
      return 'signed-in';
    }
    return this.present();
  }

  /**
   * Convenience for buttons and form actions: returns true only when the
   * customer is already signed in. Guests get the prompt, and choosing the
   * sign-in action takes them to the login page with a safe redirect.
   */
  async requireSignIn(redirect?: string): Promise<boolean> {
    if (await this.isSignedIn()) {
      return true;
    }

    const result = await this.present();
    if (result === 'sign-in') {
      await this.router.navigate(
        ['/login'],
        redirect ? { queryParams: { redirect } } : {}
      );
    }
    return false;
  }

  /** Waits for Firebase to restore the session before deciding. */
  async isSignedIn(): Promise<boolean> {
    try {
      const user = await firstValueFrom(
        this.auth.user$.pipe(take(1), catchError(() => of(null)))
      );
      return user !== null;
    } catch {
      return false;
    }
  }

  private present(): Promise<SignInPromptResult> {
    if (!this.pending) {
      this.pending = this.open().finally(() => {
        this.pending = null;
      });
    }
    return this.pending;
  }

  private async open(): Promise<SignInPromptResult> {
    const alert = await this.alertController.create({
      header: SIGN_IN_REQUIRED_TITLE,
      message: SIGN_IN_REQUIRED_MESSAGE,
      cssClass: 'bb-signin-alert',
      backdropDismiss: true,
      buttons: [
        { text: '✕', role: 'cancel', cssClass: 'bb-signin-close' },
        {
          text: 'Sign In / Log In',
          role: 'sign-in',
          cssClass: 'bb-signin-action',
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'sign-in' ? 'sign-in' : 'dismissed';
  }
}
