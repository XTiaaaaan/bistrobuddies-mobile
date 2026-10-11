import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutPage } from './about.page';

describe('AboutPage', () => {
  let component: AboutPage;
  let fixture: ComponentFixture<AboutPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AboutPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('describes the app as a convenient way to order coffee from home', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('mobile coffee-ordering app');
    expect(text).toContain('from the comfort of your home');
    expect(text).toContain('choose your preferred size and sugar level');
    expect(text).toContain('place your order through your phone');
    expect(text).not.toContain('Placeholder');
  });
});
