import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  TERMS_CONTACT,
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
} from '../../core/legal/terms-content';
import { TermsPage } from './terms.page';

describe('TermsPage', () => {
  let fixture: ComponentFixture<TermsPage>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsPage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the page title and the maintainable last-updated date', () => {
    expect(element.querySelector('ion-title')?.textContent).toContain('Terms of Service');
    expect(
      element.querySelector('[data-testid="terms-last-updated"]')?.textContent
    ).toContain(TERMS_LAST_UPDATED);
  });

  it('renders every required section with a semantic heading', () => {
    TERMS_SECTIONS.forEach((section) => {
      const card = element.querySelector(`#${section.id}`);
      expect(card).toBeTruthy();
      expect(card?.querySelector('h2')?.textContent).toContain(section.title);
    });

    // One heading per section plus the "Related pages" card.
    expect(element.querySelectorAll('.terms-section-title')).toHaveLength(
      TERMS_SECTIONS.length + 1
    );
    expect(element.querySelector('h1')?.textContent).toContain('Terms of Service');
  });

  it('explains how personal information is used', () => {
    const privacy = element.querySelector('#privacy');
    expect(privacy?.textContent).toContain('order details');
    expect(privacy?.textContent).toContain('not sold to third parties');
  });

  it('links to the confirmed contact email, phone and location', () => {
    const mail = element.querySelector('.terms-contact a[href^="mailto:"]');
    const tel = element.querySelector('.terms-contact a[href^="tel:"]');

    expect(mail?.getAttribute('href')).toBe(`mailto:${TERMS_CONTACT.email}`);
    expect(tel?.getAttribute('href')).toBe(`tel:${TERMS_CONTACT.phone}`);
    expect(element.textContent).toContain(TERMS_CONTACT.location);
  });

  it('reflects the real sizes, representative prices and payment methods', () => {
    const text = element.textContent ?? '';

    expect(text).toContain('Small ₱100');
    expect(text).toContain('Medium ₱120');
    expect(text).toContain('Large ₱150');
    expect(text).toContain('Cash on Delivery');
    expect(text).toContain('GCash');
    expect(text).toContain('verified manually');
    expect(text).not.toContain('PayMongo');
  });
});
