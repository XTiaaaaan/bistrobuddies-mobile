import { Component, computed, input } from '@angular/core';
import { formatMessageDate } from '../../core/messages/message-display';
import {
  ContactMessage,
  ContactMessageReply,
} from '../../models/contact-message.model';

/**
 * Conversation view for a customer's contact message inside the My
 * Messages detail modal: the customer's original message followed by any
 * admin replies, oldest first. Replies always come from the backend list
 * (`GET /contact-messages/mine`) — they are never invented client-side.
 */
@Component({
  selector: 'app-message-conversation',
  templateUrl: './message-conversation.component.html',
  styleUrls: ['./message-conversation.component.scss'],
  standalone: true,
})
export class MessageConversationComponent {
  readonly message = input<ContactMessage | null>(null);

  readonly replies = computed(() => this.message()?.replies ?? []);

  /** Label above a reply bubble. */
  replySender(reply: ContactMessageReply): string {
    return reply.senderRole === 'ADMIN' ? 'BistroBuddies Team' : 'You';
  }

  formatDate = formatMessageDate;
}
