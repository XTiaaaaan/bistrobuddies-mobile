import { Component, ViewChild } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cafe } from 'ionicons/icons';
import { ProductGridComponent } from '../../components/product-grid/product-grid.component';
import { RefresherEvent, withRefresh } from '../../core/refresher/refresher';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: true,
  imports: [
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    ProductGridComponent,
  ],
})
export class ProductsPage {
  /** Menu grid behind the page; pull-to-refresh asks it for a fresh catalog. */
  @ViewChild(ProductGridComponent) private grid?: ProductGridComponent;

  constructor() {
    addIcons({ cafe });
  }

  onRefresh(event: RefresherEvent): Promise<void> {
    return withRefresh(event, async () => {
      await this.grid?.reload();
    });
  }
}
