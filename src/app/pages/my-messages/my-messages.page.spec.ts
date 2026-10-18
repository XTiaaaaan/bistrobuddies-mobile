import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  ContactMessage,
  ContactMessageReply,
} from '../../models/contact-message.model';
import {
  ContactApiError,
  ContactMessagesService,
} from '../../services/contact-messages.service';
import { MyMessagesPage } from './my-messages.page';

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

function flush(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('MyMessagesPage', () => {
  function setup(listMine: ReturnType<typeof vi.fn>): ComponentFixture<MyMessagesPage> {
    TestBed.configureTestingModule({
      imports: [MyMessagesPage],
      providers: [
        provideRouter([]),
        { provide: ContactMessagesService, useValue: { listMine } },
      ],
    });

    const fixture = TestBed.createComponent(MyMessagesPage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows a loading state while the messages are being fetched', () => {
    const fixture = setup(vi.fn(() => new Promise(() => undefined)));
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.status()).toBe('loading');
    expect(element.textContent).toContain('Loading your messages...');
  });

  it('renders subject, preview, date, status badge and hint', async () => {
    const fixture = setup(vi.fn(() => Promise.resolve([makeMessage()])));
    await flush();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.status()).toBe('ready');
    expect(element.textContent).toContain('Order question');
    expect(element.textContent).toContain('Where is my order?');
    expect(element.textContent).toContain('NEW');
    expect(element.textContent).toContain('Submitted — awaiting review');
    expect(element.querySelector('.msg-new')).toBeTruthy();
    expect(element.querySelector('button.message-card')).toBeTruthy();
  });

  it('labels READ and RESOLVED messages with their own badge classes', async () => {
    const fixture = setup(
      vi.fn(() =>
        Promise.resolve([
          makeMessage({ id: 'msg-2', status: 'READ' }),
          makeMessage({ id: 'msg-3', status: 'RESOLVED' }),
        ])
      )
    );
    await flush();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.msg-read')).toBeTruthy();
    expect(element.querySelector('.msg-resolved')).toBeTruthy();
    expect(element.textContent).toContain('An admin has reviewed your message');
    expect(element.textContent).toContain('Your request has been addressed');
  });

  it('shows the friendly empty state when there are no messages', async () => {
    const fixture = setup(vi.fn(() => Promise.resolve([])));
    await flush();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.status()).toBe('empty');
    expect(element.textContent).toContain("You haven't sent any messages yet.");
  });

  it('shows an error state with a retry action when loading fails', async () => {
    const listMine = vi.fn(() => Promise.reject(new Error('boom')));
    const fixture = setup(listMine);
    await flush();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.status()).toBe('error');
    expect(element.textContent).toContain('Could not load your messages');

    const retry = element.querySelector('.state button, .state ion-button');
    expect(retry).not.toBeNull();
  });

  it('asks the customer to sign in when the session is rejected', async () => {
    const fixture = setup(
      vi.fn(() => Promise.reject(new ContactApiError('Please sign in again.', 401)))
    );
    await flush();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.status()).toBe('signed-out');
    expect(element.textContent).toContain('Please sign in to see your messages');
  });

  it('opens a message into the detail view and closes it again', async () => {
    const fixture = setup(vi.fn(() => Promise.resolve([makeMessage()])));
    await flush();
    fixture.detectChanges();

    const message = makeMessage();
    fixture.componentInstance.openMessage(message);
    expect(fixture.componentInstance.selected()).toEqual(message);

    fixture.componentInstance.closeDetail();
    expect(fixture.componentInstance.selected()).toBeNull();
  });

  it('refreshes the list when the customer asks for it', async () => {
    const listMine = vi
      .fn()
      .mockResolvedValueOnce([makeMessage()])
      .mockResolvedValueOnce([makeMessage({ status: 'RESOLVED' })]);
    const fixture = setup(listMine);
    await flush();
    fixture.detectChanges();

    expect(fixture.componentInstance.messages()[0].status).toBe('NEW');

    fixture.componentInstance.refresh();
    await flush();
    fixture.detectChanges();

    expect(listMine).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.messages()[0].status).toBe('RESOLVED');
  });

  it('closes the pull-to-refresh spinner after reloading the list', async () => {
    const listMine = vi
      .fn()
      .mockResolvedValueOnce([makeMessage()])
      .mockResolvedValueOnce([makeMessage({ status: 'RESOLVED' })]);
    const fixture = setup(listMine);
    await flush();
    fixture.detectChanges();

    const complete = vi.fn(() => Promise.resolve());
    await fixture.componentInstance.onRefresh({ target: { complete } });
    fixture.detectChanges();

    expect(listMine).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.messages()[0].status).toBe('RESOLVED');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('closes the spinner and keeps the list when a pull-to-refresh fails', async () => {
    const listMine = vi
      .fn()
      .mockResolvedValueOnce([makeMessage()])
      .mockRejectedValueOnce(new Error('offline'));
    const fixture = setup(listMine);
    await flush();
    fixture.detectChanges();

    const complete = vi.fn(() => Promise.resolve());
    await fixture.componentInstance.onRefresh({ target: { complete } });
    fixture.detectChanges();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.status()).toBe('ready');
    expect(fixture.componentInstance.messages()).toHaveLength(1);
    expect(fixture.componentInstance.errorMessage()).not.toBe('');
  });

  describe('message detail replies', () => {
    // The detail modal's ng-template content is projected by Ionic at
    // runtime, not by Angular in jsdom, so these tests assert the page
    // state the conversation component receives. The rendered reply
    // bubbles themselves are covered by MessageConversationComponent's
    // own spec.

    it('passes the selected message with its replies to the conversation view', async () => {
      const replied = makeMessage({
        status: 'READ',
        replies: [makeReply()],
      });
      const fixture = setup(vi.fn(() => Promise.resolve([replied])));
      await flush();
      fixture.detectChanges();

      fixture.componentInstance.openMessage(replied);
      await flush();
      fixture.detectChanges();

      const selected = fixture.componentInstance.selected();
      expect(selected?.status).toBe('READ');
      expect(selected?.replies).toEqual([makeReply()]);
      // The customer's original message stays in the conversation payload.
      expect(selected?.message).toBe('Where is my order?');
    });

    it('brings newly saved replies into the open detail view on refresh', async () => {
      const listMine = vi
        .fn()
        .mockResolvedValueOnce([makeMessage()])
        .mockResolvedValueOnce([
          makeMessage({ status: 'READ', replies: [makeReply()] }),
        ]);
      const fixture = setup(listMine);
      await flush();
      fixture.detectChanges();

      fixture.componentInstance.openMessage(makeMessage());
      await flush();
      fixture.detectChanges();

      expect(fixture.componentInstance.selected()?.replies).toEqual([]);

      fixture.componentInstance.refresh();
      await flush();
      fixture.detectChanges();

      expect(listMine).toHaveBeenCalledTimes(2);
      const refreshed = fixture.componentInstance.selected();
      expect(refreshed?.replies).toEqual([makeReply()]);
      expect(refreshed?.status).toBe('READ');
    });

    it('closes the detail view when a refresh no longer finds the message', async () => {
      const listMine = vi
        .fn()
        .mockResolvedValueOnce([makeMessage()])
        .mockResolvedValueOnce([]);
      const fixture = setup(listMine);
      await flush();
      fixture.detectChanges();

      fixture.componentInstance.openMessage(makeMessage());
      fixture.componentInstance.refresh();
      await flush();
      fixture.detectChanges();

      expect(fixture.componentInstance.selected()).toBeNull();
    });
  });
});
