import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAX_PAYMENT_PROOF_BYTES,
  PAYMENT_PROOF_MESSAGES,
} from '../../core/payment/payment-proof';
import { PaymentProofUploadComponent } from './payment-proof-upload.component';

function proofFile(name = 'proof.png', type = 'image/png', size = 16): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('PaymentProofUploadComponent', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  function setup(): {
    fixture: ComponentFixture<PaymentProofUploadComponent>;
    component: PaymentProofUploadComponent;
    emitted: ReturnType<typeof vi.fn>;
    input: HTMLInputElement;
  } {
    const fixture = TestBed.createComponent(PaymentProofUploadComponent);
    const emitted = vi.fn();
    fixture.componentInstance.fileSelected.subscribe(emitted);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    return { fixture, component: fixture.componentInstance, emitted, input };
  }

  function select(input: HTMLInputElement, file: File): void {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change'));
  }

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:proof-preview');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows a preview and emits a valid selected image', () => {
    const { fixture, component, emitted, input } = setup();
    const file = proofFile();

    select(input, file);
    fixture.detectChanges();

    expect(component.selectedFile()).toBe(file);
    expect(component.previewUrl()).toBe('blob:proof-preview');
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(emitted).toHaveBeenCalledWith(file);
    const preview = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="payment-proof-preview"] img'
    ) as HTMLImageElement | null;
    expect(preview?.getAttribute('src')).toBe('blob:proof-preview');
  });

  it('rejects an unsupported file without emitting it', () => {
    const { fixture, component, emitted, input } = setup();

    select(input, proofFile('proof.gif', 'image/gif'));
    fixture.detectChanges();

    expect(component.selectedFile()).toBeNull();
    expect(component.previewUrl()).toBeNull();
    expect(component.errorMessage()).toBe(PAYMENT_PROOF_MESSAGES.unsupported);
    expect(emitted).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="payment-proof-error"]'
      )?.textContent
    ).toContain('JPEG, PNG, or WebP');
  });

  it('rejects images larger than the 5 MB limit', () => {
    const { fixture, component, emitted, input } = setup();

    select(input, proofFile('proof.png', 'image/png', MAX_PAYMENT_PROOF_BYTES + 1));
    fixture.detectChanges();

    expect(component.errorMessage()).toBe(PAYMENT_PROOF_MESSAGES.tooLarge);
    expect(emitted).not.toHaveBeenCalled();
  });

  it('clears the preview and emits null when removed', () => {
    const { fixture, component, emitted, input } = setup();
    select(input, proofFile());
    fixture.detectChanges();

    const remove = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="remove-payment-proof"]'
    ) as HTMLButtonElement;
    remove.click();
    fixture.detectChanges();

    expect(component.selectedFile()).toBeNull();
    expect(component.previewUrl()).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:proof-preview');
    expect(emitted).toHaveBeenLastCalledWith(null);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="payment-proof-preview"]'
      )
    ).toBeNull();
  });

  it('revokes the previous preview when a replacement is selected', () => {
    const { fixture, component, input } = setup();
    select(input, proofFile('first.png'));
    fixture.detectChanges();

    createObjectURL.mockReturnValue('blob:second-preview');
    select(input, proofFile('second.png'));
    fixture.detectChanges();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:proof-preview');
    expect(component.fileName()).toBe('second.png');
    expect(component.previewUrl()).toBe('blob:second-preview');
  });
});
