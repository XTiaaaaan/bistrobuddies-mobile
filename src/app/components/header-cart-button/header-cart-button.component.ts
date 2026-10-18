import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cart } from 'ionicons/icons';
import { CartService } from '../../services/cart.service';

/** Header cart shortcut with a live badge; also the add-to-cart flight target. */
@Component({
  selector: 'app-header-cart-button',
  templateUrl: './header-cart-button.component.html',
  styleUrls: ['./header-cart-button.component.scss'],
  standalone: true,
  imports: [IonButton, IonIcon, RouterLink],
})
export class HeaderCartButtonComponent {
  private readonly cartService = inject(CartService);

  readonly cartCount = computed(() => this.cartService.itemCount());

  constructor() {
    addIcons({ cart });
  }
}
