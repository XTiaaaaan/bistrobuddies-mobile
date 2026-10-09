import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { redirectTarget } from '../../core/auth/auth-redirect';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
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
export class RegisterPage {
  name = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';

  readonly errorMessage = signal('');
  readonly status = signal('');
  readonly loading = signal(false);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  async register(): Promise<void> {
    if (!this.formValid()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.status.set('Creating your account...');

    try {
      await this.auth.register(
        {
          name: this.name,
          email: this.email,
          phone: this.phone,
          password: this.password,
        },
        (message) => this.status.set(message)
      );
      await this.goToTarget();
    } catch (error) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
      this.status.set('');
    }
  }

  private formValid(): boolean {
    const name = this.name.trim();
    const email = this.email.trim();

    if (!name) {
      this.errorMessage.set('Please enter your name.');
      return false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMessage.set('Please enter a valid email address.');
      return false;
    }
    if (this.password.length < 6) {
      this.errorMessage.set('Password should be at least 6 characters.');
      return false;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
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
