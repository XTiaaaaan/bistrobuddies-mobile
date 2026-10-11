import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyHistoryPage } from './company-history.page';

describe('CompanyHistoryPage', () => {
  let fixture: ComponentFixture<CompanyHistoryPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyHistoryPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyHistoryPage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('tells the company story in a single paragraph', () => {
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('Company History');
    expect(text).toContain('five coffee-loving friends');
    expect(text).toContain('Technological Institute of the Philippines');
    expect(text).toContain(
      'to make enjoying delicious coffee easier and more convenient for everyone'
    );
    expect(element.querySelectorAll('.info-card')).toHaveLength(1);
    expect(element.querySelectorAll('.info-card p')).toHaveLength(1);
    expect(element.querySelectorAll('.placeholder-tag')).toHaveLength(0);
  });
});
