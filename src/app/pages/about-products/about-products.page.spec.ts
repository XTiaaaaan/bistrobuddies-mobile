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

  it('describes the coffee and keeps the product facts with peso pricing', () => {
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('About Our Products');
    expect(text).toContain('fresh coffee beans');
    expect(text).toContain('rich aroma and satisfying flavor in every cup');
    expect(text).toContain('made with care and quality ingredients');
    expect(text).toContain('₱');
    expect(element.querySelectorAll('.placeholder-tag')).toHaveLength(0);
  });
});
