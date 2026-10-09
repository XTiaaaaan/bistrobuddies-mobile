import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cafe, home } from 'ionicons/icons';
import { ProductGridComponent } from '../../components/product-grid/product-grid.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonTitle,
    IonToolbar,
    ProductGridComponent,
    RouterLink,
  ],
})
export class DashboardPage implements OnInit {
  /** First name of the signed-in customer, null while unknown. */
  readonly customerName = signal<string | null>(null);
  /** Guests see the real menu too, but need an account to check out. */
  readonly signedIn = signal(false);

  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ cafe, home });
  }

  ngOnInit() {
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.signedIn.set(user !== null);
        const name = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
        this.customerName.set(name ? name : null);
      });
  }
}
