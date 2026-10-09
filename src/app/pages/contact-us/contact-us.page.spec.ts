import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContactUsPage } from './contact-us.page';

describe('ContactUsPage', () => {
  let fixture: ComponentFixture<ContactUsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactUsPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactUsPage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('labels the missing shop contact details as a placeholder', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Contact Us');
    expect(element.querySelectorAll('.placeholder-tag').length).toBeGreaterThan(0);
    expect(element.textContent).toContain('have not been provided');
    expect(element.textContent).toContain('Developers');
  });
});
