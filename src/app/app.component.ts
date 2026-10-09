import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  homeSharp,
  listOutline,
  listSharp,
  cartOutline,
  cartSharp,
  receiptOutline,
  receiptSharp,
  informationCircleOutline,
  informationCircleSharp,
  peopleOutline,
  peopleSharp,
  logInOutline,
  logInSharp,
  logOutOutline,
  logOutSharp,
  chevronForwardOutline,
  chevronForwardSharp,
} from 'ionicons/icons';

import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    RouterLink,
    IonApp,
    IonMenu,
    IonHeader,
    IonContent,
    IonList,
    IonMenuToggle,
    IonItem,
    IonIcon,
    IonLabel,
    IonFooter,
    IonRouterOutlet,
  ],
})
export class AppComponent implements OnInit {
  protected readonly appPages = [
    { title: 'Dashboard', url: '/dashboard', icon: 'home' },
    { title: 'Buy Coffee', url: '/products', icon: 'list' },
    { title: 'Cart', url: '/cart', icon: 'cart' },
    { title: 'My Orders', url: '/my-orders', icon: 'receipt' },
    { title: 'About the App', url: '/about', icon: 'information-circle' },
    { title: 'Developers', url: '/developers', icon: 'people' },
  ];

  protected readonly selectedIndex = signal(0);
  protected readonly signedIn = signal(false);

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({
      homeOutline,
      homeSharp,
      listOutline,
      listSharp,
      cartOutline,
      cartSharp,
      receiptOutline,
      receiptSharp,
      informationCircleOutline,
      informationCircleSharp,
      peopleOutline,
      peopleSharp,
      logInOutline,
      logInSharp,
      logOutOutline,
      logOutSharp,
      chevronForwardOutline,
      chevronForwardSharp,
    });
  }

  ngOnInit() {
    this.auth.isAuthenticated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((signedIn) => this.signedIn.set(signedIn));

    this.updateSelected(this.router.url);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateSelected(event.urlAfterRedirects);
      }
    });
  }

  private updateSelected(url: string) {
    const index = this.appPages.findIndex((page) =>
      url.startsWith(page.url)
    );
    this.selectedIndex.set(index >= 0 ? index : 0);
  }

  async onLogout() {
    if (!this.signedIn()) {
      await this.router.navigate(['/login']);
      return;
    }

    try {
      await this.auth.logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
    await this.router.navigate(['/login']);
  }
}
