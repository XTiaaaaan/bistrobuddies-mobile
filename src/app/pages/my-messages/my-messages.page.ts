import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, close, mail, refresh } from 'ionicons/icons';
import { MessageConversationComponent } from '../../components/message-conversation/message-conversation.component';
import {
  contactMessageStatusClass,
  contactMessageStatusHint,
  contactMessageStatusLabel,
  formatMessageDate,
  messagePreview,
} from '../../core/messages/message-display';
import { RefresherEvent, withRefresh } from '../../core/refresher/refresher';
import { ContactMessage } from '../../models/contact-message.model';
import {
  ContactApiError,
  ContactMessagesService,
} from '../../services/contact-messages.service';

export type MyMessagesStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'signed-out';

@Component({
  selector: 'app-my-messages',
  templateUrl: './my-messages.page.html',
  styleUrls: ['./my-messages.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar,
    MessageConversationComponent,
    RouterLink,
  ],
})
export class MyMessagesPage implements OnInit {
  readonly status = signal<MyMessagesStatus>('loading');
  readonly messages = signal<ContactMessage[]>([]);
  readonly refreshing = signal(false);
  readonly errorMessage = signal('');
  readonly selected = signal<ContactMessage | null>(null);

  readonly hasMessages = computed(() => this.messages().length > 0);

  private readonly contactApi = inject(ContactMessagesService);

  constructor() {
    addIcons({ alertCircle, close, mail, refresh });
  }

  ngOnInit(): void {
    void this.load();
  }

  /** Fetches the signed-in customer's own messages from the backend. */
  async load(options: { refreshing?: boolean } = {}): Promise<void> {
    const isRefresh = options.refreshing === true;
    if (isRefresh) {
      this.refreshing.set(true);
    } else {
      this.status.set('loading');
      this.errorMessage.set('');
    }

    try {
      const messages = await this.contactApi.listMine();
      this.messages.set(messages);
      this.status.set(messages.length > 0 ? 'ready' : 'empty');
      // Keep the open detail view fresh: a refresh may bring newly saved
      // admin replies, always from the backend list — never invented here.
      const open = this.selected();
      if (open) {
        this.selected.set(
          messages.find((message) => message.id === open.id) ?? null
        );
      }
    } catch (error) {
      if (isRefresh && this.status() === 'ready') {
        // Keep the list already on screen; a failed refresh is a banner, not
        // a replacement of working data with an error state.
        this.errorMessage.set(this.describeError(error));
      } else if (error instanceof ContactApiError && error.status === 401) {
        this.status.set('signed-out');
      } else {
        this.errorMessage.set(this.describeError(error));
        this.status.set('error');
      }
    } finally {
      this.refreshing.set(false);
    }
  }

  refresh(): void {
    if (this.refreshing()) {
      return;
    }
    void this.load({ refreshing: true });
  }

  /** Pull-to-refresh: re-fetches the list, then closes the spinner. */
  onRefresh(event: RefresherEvent): Promise<void> {
    return withRefresh(event, () => this.load({ refreshing: true }));
  }

  openMessage(message: ContactMessage): void {
    this.selected.set(message);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  private describeError(error: unknown): string {
    if (error instanceof ContactApiError) {
      return error.message;
    }
    return "We couldn't load your messages. Please try again.";
  }

  formatDate = formatMessageDate;
  statusLabel = contactMessageStatusLabel;
  statusClass = contactMessageStatusClass;
  statusHint = contactMessageStatusHint;
  preview = messagePreview;
}
