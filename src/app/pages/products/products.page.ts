import { Component, computed, inject } from '@angular/core';
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
import { cafe, cart } from 'ionicons/icons';
import { ProductGridComponent } from '../../components/product-grid/product-grid.component';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
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
export class ProductsPage {
  private readonly cartService = inject(CartService);

  /** Live counter shown on the header cart button. */
  readonly cartCount = computed(() => this.cartService.itemCount());

  constructor() {
    addIcons({ cafe, cart });
  }
}
