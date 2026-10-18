import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ContactMessage,
  ContactMessageReply,
} from '../../models/contact-message.model';
import { MessageConversationComponent } from './message-conversation.component';

function makeReply(overrides: Partial<ContactMessageReply> = {}): ContactMessageReply {
  return {
    id: 'reply-1',
    senderRole: 'ADMIN',
    reply: 'We found your order — shipping tomorrow.',
    createdAt: '2026-10-10T09:00:00.000Z',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ContactMessage> = {}): ContactMessage {
  return {
    id: 'msg-1',
    subject: 'Order question',
    message: 'Where is my order?',
    status: 'NEW',
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:00:00.000Z',
    replies: [],
    ...overrides,
  };
}

describe('MessageConversationComponent', () => {
  function setup(message: ContactMessage | null): {
    fixture: ComponentFixture<MessageConversationComponent>;
    element: HTMLElement;
  } {
    TestBed.configureTestingModule({ imports: [MessageConversationComponent] });
    const fixture = TestBed.createComponent(MessageConversationComponent);
    fixture.componentRef.setInput('message', message);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the customer message and admin reply as distinct bubbles', () => {
    const { element } = setup(
      makeMessage({ status: 'READ', replies: [makeReply()] })
    );

    const customer = element.querySelector('.bubble.from-customer');
    const admin = element.querySelector('.bubble.from-admin');
    expect(customer).toBeTruthy();
    expect(admin).toBeTruthy();

    const texts = element.textContent ?? '';
    expect(texts).toContain('Where is my order?');
    expect(texts).toContain('We found your order — shipping tomorrow.');
    // The admin bubble carries the team label and the reply date.
    expect(admin?.textContent).toContain('BistroBuddies Team');
    expect(admin?.textContent).toContain('Oct 10, 2026');
    expect(customer?.textContent).toContain('You');
  });

  it('shows the friendly no-reply message when there are no replies yet', () => {
    const { element } = setup(makeMessage());

    expect(element.querySelector('.no-replies')?.textContent).toContain(
      "Our team hasn't replied yet. Please check back later."
    );
    expect(element.querySelector('.bubble.from-admin')).toBeNull();
    // The customer's original message is still part of the conversation.
    expect(element.textContent).toContain('Where is my order?');
  });

  it('shows multiple replies in the order the backend returns them', () => {
    const replies = [
      makeReply({
        id: 'reply-1',
        reply: 'First reply.',
        createdAt: '2026-10-10T09:00:00.000Z',
      }),
      makeReply({
        id: 'reply-2',
        reply: 'Second reply.',
        createdAt: '2026-10-11T09:00:00.000Z',
      }),
    ];
    const { element } = setup(makeMessage({ status: 'READ', replies }));

    const bubbles = element.querySelectorAll('.bubble.from-admin');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].textContent).toContain('First reply.');
    expect(bubbles[1].textContent).toContain('Second reply.');
  });

  it('labels a reserved CUSTOMER sender as You', () => {
    const { element } = setup(
      makeMessage({
        status: 'READ',
        replies: [makeReply({ senderRole: 'CUSTOMER' })],
      })
    );

    expect(element.querySelector('.bubble.from-admin')?.textContent).toContain(
      'You'
    );
  });

  it('renders no conversation content without a message', () => {
    const { element } = setup(null);
    expect(element.querySelector('.bubble')).toBeNull();
    expect((element.textContent ?? '').trim()).toBe('');
  });
});
