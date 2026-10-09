import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { authErrorMessage } from '../../core/auth/auth-errors';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonList,
    IonTitle,
    IonToolbar,
  ],
})
export class ForgotPasswordPage {
  email = '';

  readonly errorMessage = signal('');
  readonly sent = signal(false);
  readonly loading = signal(false);

  private readonly auth = inject(AuthService);

  async sendResetLink(): Promise<void> {
    const email = this.email.trim();
    if (!email) {
      this.errorMessage.set('Enter your email address.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.sendPasswordReset(email);
      this.sent.set(true);
    } catch (error) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
