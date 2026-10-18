import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderApiError, OrdersApiService } from '../../services/orders-api.service';
import { GcashSubmissionFormComponent } from './gcash-submission-form.component';

describe('GcashSubmissionFormComponent', () => {
  function setup(
    submitGcashDetails: ReturnType<typeof vi.fn> = vi.fn(() =>
      Promise.resolve({
        id: 'order-1',
        paymentStatus: 'VERIFYING',
        gcashDetails: { accountName: 'Juan dela Cruz', accountNumber: '09171234567' },
      })
    ),
    inputs: { initialName?: string; initialNumber?: string } = {}
  ): {
    fixture: ComponentFixture<GcashSubmissionFormComponent>;
    component: GcashSubmissionFormComponent;
    submitGcashDetails: ReturnType<typeof vi.fn>;
    submitted: ReturnType<typeof vi.fn>;
    sessionExpired: ReturnType<typeof vi.fn>;
  } {
    TestBed.configureTestingModule({
      imports: [GcashSubmissionFormComponent],
      providers: [{ provide: OrdersApiService, useValue: { submitGcashDetails } }],
    });

    const fixture = TestBed.createComponent(GcashSubmissionFormComponent);
    fixture.componentRef.setInput('orderId', 'order-1');
    fixture.componentRef.setInput('initialName', inputs.initialName ?? '');
    fixture.componentRef.setInput('initialNumber', inputs.initialNumber ?? '');
    const submitted = vi.fn();
    const sessionExpired = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.sessionExpired.subscribe(sessionExpired);
    fixture.detectChanges();

    return {
      fixture,
      component: fixture.componentInstance,
      submitGcashDetails,
      submitted,
      sessionExpired,
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should disable submit until both fields are valid', () => {
    const { component } = setup();

    expect(component.canSubmit()).toBe(false);

    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setNumber({ detail: { value: '09171234567' } });
    expect(component.canSubmit()).toBe(true);
  });

  it('should flag an invalid Philippine mobile number and a too-short name', () => {
    const { component } = setup();

    component.setName({ detail: { value: 'J' } });
    component.setNumber({ detail: { value: '12345' } });
    component.touched.set(true);

    expect(component.invalidName()).toBe(true);
    expect(component.invalidNumber()).toBe(true);

    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setNumber({ detail: { value: '+63 917 123 4567' } });
    expect(component.invalidName()).toBe(false);
    expect(component.invalidNumber()).toBe(false);
  });

  it('should not call the API when the inputs are invalid', async () => {
    const { component, submitGcashDetails } = setup();

    component.setName({ detail: { value: 'J' } });
    component.setNumber({ detail: { value: 'nope' } });
    await component.submit();

    expect(submitGcashDetails).not.toHaveBeenCalled();
    expect(component.touched()).toBe(true);
  });

  it('should submit trimmed details and emit the server payment status', async () => {
    const { component, submitGcashDetails, submitted } = setup();

    component.setName({ detail: { value: '  Juan dela Cruz  ' } });
    component.setNumber({ detail: { value: ' 09171234567 ' } });
    await component.submit();

    expect(submitGcashDetails).toHaveBeenCalledWith('order-1', {
      accountName: 'Juan dela Cruz',
      accountNumber: '09171234567',
    });
    expect(submitted).toHaveBeenCalledWith({ paymentStatus: 'VERIFYING' });
  });

  it('should prefill the previous submission values', () => {
    const { component } = setup(undefined, {
      initialName: 'Juan dela Cruz',
      initialNumber: '09171234567',
    });

    expect(component.accountName()).toBe('Juan dela Cruz');
    expect(component.accountNumber()).toBe('09171234567');
  });

  it('should surface backend errors without emitting success', async () => {
    const failing = vi.fn(() =>
      Promise.reject(new OrderApiError('Invalid account number.', 400))
    );
    const { component, submitted } = setup(failing);

    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setNumber({ detail: { value: '09171234567' } });
    await component.submit();

    expect(submitted).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Invalid account number.');
    expect(component.submitting()).toBe(false);
  });

  it('should emit sessionExpired and a sign-in message on a 401', async () => {
    const expired = vi.fn(() =>
      Promise.reject(new OrderApiError('Authentication is required.', 401))
    );
    const { component, sessionExpired, submitted } = setup(expired);

    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setNumber({ detail: { value: '09171234567' } });
    await component.submit();

    expect(submitted).not.toHaveBeenCalled();
    expect(sessionExpired).toHaveBeenCalledTimes(1);
    expect(component.errorMessage()).toContain('session has expired');
  });

  it('should guard against duplicate submissions while one is in flight', async () => {
    let resolveSubmit: (value: unknown) => void = () => undefined;
    const pending = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const { component, submitGcashDetails } = setup(pending);

    component.setName({ detail: { value: 'Juan dela Cruz' } });
    component.setNumber({ detail: { value: '09171234567' } });

    const first = component.submit();
    expect(component.submitting()).toBe(true);
    await component.submit();

    expect(submitGcashDetails).toHaveBeenCalledTimes(1);

    resolveSubmit({ id: 'order-1', paymentStatus: 'VERIFYING' });
    await first;
    expect(component.submitting()).toBe(false);
  });
});
