import { Component } from '@angular/core';
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
import { cafe } from 'ionicons/icons';

@Component({
  selector: 'app-about-products',
  templateUrl: './about-products.page.html',
  styleUrls: ['./about-products.page.scss'],
  standalone: true,
  imports: [
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class AboutProductsPage {
  constructor() {
    addIcons({ cafe });
  }
}
