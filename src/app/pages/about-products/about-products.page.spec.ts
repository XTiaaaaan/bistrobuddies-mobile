import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutProductsPage } from './about-products.page';

describe('AboutProductsPage', () => {
  let fixture: ComponentFixture<AboutProductsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutProductsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutProductsPage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('labels the missing product story as a placeholder and shows peso pricing', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('About Our Products');
    expect(element.querySelectorAll('.placeholder-tag').length).toBeGreaterThan(0);
    expect(element.textContent).toContain('₱');
  });
});
