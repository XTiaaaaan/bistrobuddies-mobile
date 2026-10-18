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
import { call, documentText, location, mail } from 'ionicons/icons';
import {
  TERMS_CONTACT,
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
} from '../../core/legal/terms-content';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.page.html',
  styleUrls: ['./terms.page.scss'],
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
export class TermsPage {
  readonly lastUpdated = TERMS_LAST_UPDATED;
  readonly sections = TERMS_SECTIONS;
  readonly contact = TERMS_CONTACT;

  constructor() {
    addIcons({ documentText, location, call, mail });
  }
}
