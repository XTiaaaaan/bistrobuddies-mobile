import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
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
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonTitle,
    IonToolbar,
    ProductGridComponent,
  ],
})
export class DashboardPage implements OnInit {
  /** First name of the signed-in customer, null while unknown. */
  readonly customerName = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ cafe, home });
  }

  ngOnInit() {
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        const name = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
        this.customerName.set(name ? name : null);
      });
  }
}
