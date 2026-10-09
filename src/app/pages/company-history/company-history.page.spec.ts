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

  it('labels the missing company information as a placeholder', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Company History');
    expect(element.textContent).toContain('Placeholder');
    expect(element.textContent).toContain('placeholder');
    expect(element.querySelectorAll('.placeholder-tag').length).toBeGreaterThan(0);
  });
});
